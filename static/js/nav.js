/* nav.js
   The logged-in half of the navbar: swaps the Login button for the person's
   profile picture (a link to their page), and runs the dropdown's log out button.
   Needs session.js, which the navbar loads first. */
(function () {
    var nav = document.getElementById('site-nav');
    if (!nav || !window.CFF) return;

    var profilesUrl = (nav.dataset.profilesUrl || '').replace(/\/+$/, '');
    var loginLink = document.getElementById('nav-login');
    var userMenu = document.getElementById('nav-user');
    var profileLink = document.getElementById('nav-profile-link');
    var logoutButton = document.getElementById('nav-logout');

    function initials(name) {
        // first letter of up to two words, ignoring digits and symbols
        var letters = name.split(/\s+/).map(function (word) {
            var match = word.match(/\p{L}/u);
            return match ? match[0] : '';
        }).filter(Boolean).slice(0, 2).join('');
        return letters.toUpperCase() || '?';
    }

    // A round picture, or the person's initials when there is no usable picture.
    // className is the base class: 'nav-avatar' here, 'pfp' on the editor page.
    function makeAvatar(url, name, className) {
        function fallback() {
            var span = document.createElement('span');
            span.className = className + ' ' + className + '-initials';
            span.setAttribute('aria-hidden', 'true');
            span.textContent = initials(name || '');
            return span;
        }
        // avatar_url is user supplied: only plain web images are allowed
        if (!/^https?:\/\//i.test(url || '')) return fallback();
        var img = document.createElement('img');
        img.className = className;
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.src = url;
        img.addEventListener('error', function () { img.replaceWith(fallback()); });
        return img;
    }
    window.CFF.makeAvatar = makeAvatar;

    function showLoggedOut() {
        loginLink.hidden = false;
        userMenu.hidden = true;
    }

    function showLoggedIn() {
        var id = window.CFF.userId();
        var email = (window.CFF.claims() || {}).email || '';

        loginLink.hidden = true;
        userMenu.hidden = false;
        profileLink.href = '/profile/' + encodeURIComponent(id);
        // a letter from the email until the real picture arrives (or if there is no profile yet)
        profileLink.replaceChildren(makeAvatar('', email, 'nav-avatar'));

        fetch(profilesUrl + '/profiles/' + encodeURIComponent(id))
            .then(function (response) { return response.ok ? response.json() : null; })
            .then(function (profile) {
                if (!profile) return;
                profileLink.replaceChildren(
                    makeAvatar(profile.avatar_url, profile.display_name || email, 'nav-avatar'));
            })
            .catch(function (error) { console.error(error); });
    }

    // The page's own scripts already ran without a token when we had to log back
    // in just now, so load the page again. The timestamp stops any reload loop.
    function reloadOnce() {
        try {
            var last = parseInt(sessionStorage.getItem('cff_reload') || '0', 10);
            if (Date.now() - last < 10000) return;
            sessionStorage.setItem('cff_reload', String(Date.now()));
        } catch (e) {
            return;
        }
        window.location.reload();
    }

    logoutButton.addEventListener('click', function () { window.CFF.logout(); });

    // Escape closes the dropdown for keyboard users (it opens on hover or focus)
    userMenu.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && document.activeElement) document.activeElement.blur();
    });

    // other scripts can wait on this before checking who is logged in
    window.CFF.ready = window.CFF.ensure().then(function (state) {
        if (state.loggedIn && window.CFF.userId()) {
            showLoggedIn();
        } else {
            showLoggedOut();
        }
        if (state.reloadNeeded) reloadOnce();
        return state;
    });
})();
