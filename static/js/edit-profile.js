(function () {
    var main = document.getElementById('main');
    var apiUrl = main.dataset.apiUrl.replace(/\/+$/, '');

    var form = document.getElementById('profile-form');
    var statusEl = document.getElementById('status');
    var avatarEl = document.getElementById('avatar');
    var saveButton = document.getElementById('save-button');
    var cancelLink = document.getElementById('cancel-link');

    var fields = {
        display_name: document.getElementById('display-name'),
        avatar_url: document.getElementById('avatar-url'),
        public_bio: document.getElementById('public-bio'),
        organization_bio: document.getElementById('org-bio'),
        program: document.getElementById('program'),
        graduation_year: document.getElementById('graduation-year')
    };
    var counters = [
        { field: fields.public_bio, el: document.getElementById('public-bio-count') },
        { field: fields.organization_bio, el: document.getElementById('org-bio-count') }
    ];

    var userId = '';
    var avatarTimer = null;

    function showStatus(text, isError) {
        statusEl.textContent = text;
        statusEl.classList.toggle('error', !!isError);
        statusEl.hidden = false;
    }

    function hideStatus() {
        statusEl.hidden = true;
    }

    // While loading or saving nothing can be typed, so a half-loaded form can never be saved
    function setBusy(busy) {
        Object.keys(fields).forEach(function (key) { fields[key].disabled = busy; });
        saveButton.disabled = busy;
    }

    // live preview of the picture, exactly as it will look on the profile page
    function renderAvatar() {
        var name = fields.display_name.value.trim() || (window.CFF.claims() || {}).email || '';
        avatarEl.replaceChildren(window.CFF.makeAvatar(fields.avatar_url.value.trim(), name, 'pfp'));
    }

    function renderAvatarSoon() {
        // wait for a pause in typing so a half-typed link isn't requested on every key
        clearTimeout(avatarTimer);
        avatarTimer = setTimeout(renderAvatar, 400);
    }

    function updateCounters() {
        counters.forEach(function (counter) {
            counter.el.textContent = counter.field.value.length + ' / ' + counter.field.maxLength;
        });
    }

    function fillPublic(profile) {
        fields.display_name.value = profile.display_name || '';
        fields.avatar_url.value = profile.avatar_url || '';
        fields.public_bio.value = profile.public_bio || '';
    }

    function fillOrganization(profile) {
        fields.organization_bio.value = profile.organization_bio || '';
        fields.program.value = profile.program || '';
        fields.graduation_year.value = profile.graduation_year == null ? '' : profile.graduation_year;
    }

    // Loads the current profile into the form. Someone with no profile yet gets an empty form.
    function load() {
        setBusy(true);
        showStatus('Loading your profile…');
        var url = apiUrl + '/profiles/' + encodeURIComponent(userId);
        var isNew = false;

        return fetch(url)
            .then(function (response) {
                if (response.status === 404) return null;
                if (!response.ok) throw new Error('Profile request failed: ' + response.status);
                return response.json();
            })
            .then(function (profile) {
                if (!profile) {
                    isNew = true;
                    return;
                }
                fillPublic(profile);
                // your own organization fields: if these can't be loaded, saving would blank them
                return window.CFF.authFetch(url + '/organization').then(function (response) {
                    if (!response.ok) throw new Error('Organization request failed: ' + response.status);
                    return response.json();
                }).then(fillOrganization);
            })
            .then(function () {
                renderAvatar();
                updateCounters();
                setBusy(false);
                if (isNew) {
                    showStatus('You don’t have a profile yet. Fill in your details and save to create it.');
                } else {
                    hideStatus();
                }
            })
            .catch(function (error) {
                console.error(error);
                // the form stays locked: saving now could overwrite details we failed to load
                showStatus('We couldn’t load your profile right now. Reload the page to try again.', true);
            });
    }

    function fail(message, field) {
        showStatus(message, true);
        field.focus();
        return null;
    }

    // checks the fields and returns the body for PUT /me/profile, or null if something is wrong
    function collect() {
        var name = fields.display_name.value.trim();
        if (!name) {
            return fail('Add a display name so other students can find you.', fields.display_name);
        }
        var avatar = fields.avatar_url.value.trim();
        if (avatar && !/^https?:\/\//i.test(avatar)) {
            return fail('The picture link must start with http:// or https://.', fields.avatar_url);
        }
        var year = null;
        var yearText = fields.graduation_year.value.trim();
        if (yearText) {
            year = Number(yearText);
            if (!Number.isInteger(year) || year < 1900 || year > 2200) {
                return fail('Graduation year must be a whole year between 1900 and 2200.', fields.graduation_year);
            }
        }
        return {
            display_name: name,
            avatar_url: avatar,
            public_bio: fields.public_bio.value.trim(),
            organization_bio: fields.organization_bio.value.trim(),
            program: fields.program.value.trim(),
            graduation_year: year
        };
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        var payload = collect();
        if (!payload) return;

        setBusy(true);
        showStatus('Saving…');
        window.CFF.authFetch(apiUrl + '/me/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (response) {
            if (response.ok) {
                window.location.href = '/profile/' + encodeURIComponent(userId);
                return;
            }
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            setBusy(false);
            showStatus(response.status === 400
                ? 'Some of those details were rejected. Check the lengths and the graduation year.'
                : 'We couldn’t save your profile right now. Please try again.', true);
        }).catch(function (error) {
            console.error(error);
            setBusy(false);
            showStatus('We couldn’t reach the profile service. Please try again in a moment.', true);
        });
    });

    fields.avatar_url.addEventListener('input', renderAvatarSoon);
    fields.display_name.addEventListener('input', renderAvatarSoon);
    counters.forEach(function (counter) {
        counter.field.addEventListener('input', updateCounters);
    });

    setBusy(true);
    window.CFF.ready.then(function () {
        userId = window.CFF.userId();
        if (!userId) {
            // not logged in: nothing to edit
            window.location.replace('/login');
            return;
        }
        cancelLink.href = '/profile/' + encodeURIComponent(userId);
        return load();
    });
})();
