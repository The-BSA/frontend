(function () {
    var main = document.getElementById('main');
    var apiUrl = main.dataset.apiUrl.replace(/\/+$/, '');

    var listEl = document.getElementById('membership-list');
    var listStatus = document.getElementById('list-status');
    var form = document.getElementById('add-email-form');
    var input = document.getElementById('school-email');
    var addButton = document.getElementById('add-email-button');
    var formStatus = document.getElementById('form-status');

    var loading = false;
    var hasPending = false;

    function showListStatus(text, isError) {
        listStatus.textContent = text;
        listStatus.classList.toggle('error', !!isError);
        listStatus.hidden = false;
    }

    function showFormStatus(text, isError) {
        formStatus.textContent = text;
        formStatus.classList.toggle('error', !!isError);
        formStatus.hidden = false;
    }

    function domainOf(email) {
        return email.split('@').pop();
    }

    function readJson(response) {
        return response.json().catch(function () { return {}; });
    }

    function fetchMemberships() {
        return window.CFF.authFetch(apiUrl + '/me/memberships').then(function (response) {
            if (response.status === 401) {
                var unauthorized = new Error('Not logged in');
                unauthorized.unauthorized = true;
                throw unauthorized;
            }
            if (!response.ok) throw new Error('Memberships request failed: ' + response.status);
            return response.json();
        }).then(function (data) {
            return data.memberships || [];
        });
    }

    function fetchOrganizationNames() {
        return fetch(apiUrl + '/organizations').then(function (response) {
            return response.ok ? response.json() : { organizations: [] };
        }).then(function (data) {
            var names = {};
            (data.organizations || []).forEach(function (organization) {
                names[organization.id] = organization.name;
            });
            return names;
        }).catch(function () {
            return {};
        });
    }

    function sendVerification(email) {
        return window.CFF.authFetch(apiUrl + '/memberships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ school_email: email })
        }).then(function (response) {
            if (response.status === 401) {
                window.location.href = '/login';
                return { handled: true };
            }
            return readJson(response).then(function (data) {
                if (response.status === 202) return { ok: true };
                return {
                    ok: false,
                    message: (data && data.error) || 'We couldn’t send the email right now. Please try again.'
                };
            });
        }).catch(function (error) {
            console.error(error);
            return {
                ok: false,
                message: 'We couldn’t reach the organizations service. Please try again in a moment.'
            };
        });
    }

    function makeItem(membership, names) {
        var li = document.createElement('li');
        li.className = 'membership';

        var info = document.createElement('div');
        info.className = 'membership-info';
        var email = document.createElement('p');
        email.className = 'membership-email';
        email.textContent = membership.school_email;
        var org = document.createElement('p');
        org.className = 'membership-org';
        org.textContent = names[membership.organization_id] || domainOf(membership.school_email);
        info.append(email, org);

        var badge = document.createElement('span');
        badge.className = 'badge ' + (membership.is_verified ? 'badge-verified' : 'badge-pending');
        badge.textContent = membership.is_verified ? 'Verified' : 'Pending';

        li.append(info, badge);

        if (!membership.is_verified) {
            var resend = document.createElement('button');
            resend.type = 'button';
            resend.className = 'secondary';
            resend.textContent = 'Resend email';

            var note = document.createElement('p');
            note.className = 'membership-note';
            note.setAttribute('role', 'status');
            note.textContent = 'Open the verification link we emailed to this address to finish.';

            resend.addEventListener('click', function () {
                resend.disabled = true;
                resend.textContent = 'Sending…';
                sendVerification(membership.school_email).then(function (result) {
                    if (result.handled) return;
                    resend.disabled = false;
                    resend.textContent = 'Resend email';
                    note.classList.toggle('error', !result.ok);
                    note.textContent = result.ok
                        ? 'Verification email sent again. Check your inbox.'
                        : result.message;
                });
            });
            li.append(resend, note);
        }
        return li;
    }

    function render(memberships, names) {
        var sorted = memberships.slice().sort(function (a, b) {
            if (a.is_verified !== b.is_verified) return a.is_verified ? -1 : 1;
            return a.id - b.id;
        });
        hasPending = sorted.some(function (m) { return !m.is_verified; });
        listEl.replaceChildren.apply(listEl, sorted.map(function (m) { return makeItem(m, names); }));
        listEl.hidden = sorted.length === 0;
        if (sorted.length === 0) {
            showListStatus('You haven’t added a school email yet.');
        } else {
            listStatus.hidden = true;
        }
    }

    function refresh() {
        if (loading) return Promise.resolve();
        loading = true;
        return Promise.all([fetchMemberships(), fetchOrganizationNames()]).then(function (results) {
            render(results[0], results[1]);
        }).catch(function (error) {
            if (error.unauthorized) {
                window.location.href = '/login';
                return;
            }
            console.error(error);
            listEl.hidden = true;
            showListStatus('We couldn’t load your emails right now. Reload the page to try again.', true);
        }).then(function () {
            loading = false;
        });
    }

    function setAdding(adding) {
        addButton.disabled = adding;
        input.disabled = adding;
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        var email = input.value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            showFormStatus('Enter a valid school email address.', true);
            input.focus();
            return;
        }
        setAdding(true);
        showFormStatus('Sending…');
        sendVerification(email).then(function (result) {
            if (result.handled) return;
            setAdding(false);
            if (!result.ok) {
                showFormStatus(result.message, true);
                input.focus();
                return;
            }
            input.value = '';
            showFormStatus('Verification email sent to ' + email + '. Open the link in that email to finish.');
            return refresh();
        });
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && hasPending) refresh();
    });

    window.CFF.ready.then(function () {
        if (!window.CFF.userId()) {
            window.location.replace('/login');
            return;
        }
        return refresh();
    });
})();
