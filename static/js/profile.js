(function () {
    var main = document.getElementById('main');
    var apiUrl = main.dataset.apiUrl.replace(/\/+$/, '');
    var userId = main.dataset.userId;
    var profileUrl = apiUrl + '/profiles/' + encodeURIComponent(userId);

    var avatarEl = document.getElementById('avatar');
    var nameEl = document.getElementById('profile-name');
    var metaEl = document.getElementById('profile-meta');
    var statusEl = document.getElementById('status');
    var bioSection = document.getElementById('bio-section');
    var bioEl = document.getElementById('profile-bio');
    var orgSection = document.getElementById('org-section');
    var orgBioEl = document.getElementById('org-bio');
    var noteEl = document.getElementById('org-note');

    function getToken() {
        var match = document.cookie.match(/(?:^|;\s*)session=([^;]+)/);
        return match ? match[1] : '';
    }

    function initials(name) {
        // first letter of up to two words, ignoring digits and symbols
        var letters = name.split(/\s+/).map(function (word) {
            var match = word.match(/\p{L}/u);
            return match ? match[0] : '';
        }).filter(Boolean).slice(0, 2).join('');
        return letters.toUpperCase() || '?';
    }

    function makeAvatar(profile, name) {
        var url = profile.avatar_url || '';
        function fallback() {
            var span = document.createElement('span');
            span.className = 'pfp pfp-initials';
            span.setAttribute('aria-hidden', 'true');
            span.textContent = initials(name);
            return span;
        }
        // avatar_url is user supplied: only plain web images are allowed
        if (!/^https?:\/\//i.test(url)) return fallback();
        var img = document.createElement('img');
        img.className = 'pfp';
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.src = url;
        img.addEventListener('error', function () { img.replaceWith(fallback()); });
        return img;
    }

    function showStatus(text) {
        statusEl.textContent = text;
        statusEl.hidden = false;
    }

    function showNote(text) {
        noteEl.textContent = text;
        noteEl.hidden = false;
    }

    function renderPublic(profile) {
        var name = (profile.display_name || '').trim() || 'Unnamed student';
        document.title = name + ' | Cohort Friend Finder';
        nameEl.textContent = name;
        avatarEl.replaceChildren(makeAvatar(profile, name));
        bioEl.textContent = profile.public_bio || 'This student has not written a bio yet.';
        bioSection.hidden = false;
        statusEl.hidden = true;
    }

    function renderOrganization(profile) {
        var meta = [];
        if (profile.program) meta.push(profile.program);
        if (profile.graduation_year) meta.push('Class of ' + profile.graduation_year);
        if (meta.length) {
            metaEl.textContent = meta.join(' · ');
            metaEl.hidden = false;
        }
        if (profile.organization_bio) {
            orgBioEl.textContent = profile.organization_bio;
            orgSection.hidden = false;
        }
    }

    function loadOrganization() {
        var token = getToken();
        if (!token) {
            showNote('Log in to see this student’s program, graduation year and organization bio ' +
                'if you share a verified organization with them.');
            return Promise.resolve();
        }
        return fetch(profileUrl + '/organization', { headers: { Authorization: 'Bearer ' + token } })
            .then(function (response) {
                if (response.ok) return response.json().then(renderOrganization);
                if (response.status === 401) {
                    showNote('Your login has expired. Log in again to see more details.');
                } else if (response.status === 403) {
                    showNote('Program, graduation year and organization bio are only shown when you ' +
                        'share a verified organization with this student.');
                } else {
                    showNote('Organization details are unavailable right now.');
                }
            })
            .catch(function (error) {
                console.error(error);
                showNote('Organization details are unavailable right now.');
            });
    }

    fetch(profileUrl)
        .then(function (response) {
            if (response.status === 404) {
                var notFound = new Error('Profile not found');
                notFound.notFound = true;
                throw notFound;
            }
            if (!response.ok) throw new Error('Profile request failed: ' + response.status);
            return response.json();
        })
        .then(function (profile) {
            renderPublic(profile);
            return loadOrganization();
        })
        .catch(function (error) {
            if (error.notFound) {
                // someone who just signed up has no profile yet: send them to create it
                if (window.CFF && String(window.CFF.userId()) === String(userId)) {
                    window.location.replace('/profile/edit');
                    return;
                }
                document.title = 'Profile not found | Cohort Friend Finder';
                showStatus('We couldn’t find that profile.');
                return;
            }
            console.error(error);
            showStatus('This profile is unavailable right now. Please try again in a moment.');
        });
})();
