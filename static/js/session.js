/* session.js
   Everything about being logged in, shared by every page: the access token
   cookie, the refresh token, silent refresh, and logout. It is exposed as
   window.CFF. The auth service address comes from the data-auth-url attribute
   on the <script> tag that loads this file. */
(function () {
    var authUrl = (document.currentScript.dataset.authUrl || '').replace(/\/+$/, '');
    var COOKIE = 'session';          // access token (other scripts read this too)
    var REFRESH_KEY = 'cff_refresh'; // refresh token, needed to log out and to stay logged in
    var timer = null;
    var inflight = null;

    function getToken() {
        var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
        return match ? match[1] : '';
    }

    function getRefreshToken() {
        try {
            return localStorage.getItem(REFRESH_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function parseToken(token) {
        try {
            var part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            while (part.length % 4) part += '=';
            var bytes = Uint8Array.from(atob(part), function (c) { return c.charCodeAt(0); });
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch (e) {
            return null;
        }
    }

    function claims() {
        return parseToken(getToken());
    }

    function userId() {
        var c = claims();
        return c && c.sub ? String(c.sub) : '';
    }

    function setSession(data) {
        var maxAge = parseInt(data.expires_in, 10) || 900;
        document.cookie = COOKIE + '=' + data.access_token +
            '; path=/; max-age=' + maxAge + '; SameSite=Lax';
        try {
            if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
        } catch (e) {
            // storage is blocked: the login will just end when the access token does
        }
        scheduleRefresh();
    }

    function clearSession() {
        clearTimeout(timer);
        document.cookie = COOKIE + '=; path=/; max-age=0; SameSite=Lax';
        try {
            localStorage.removeItem(REFRESH_KEY);
        } catch (e) {
            // nothing to clear
        }
    }

    // get a new access token a minute before the current one runs out
    function scheduleRefresh() {
        clearTimeout(timer);
        var c = claims();
        if (!c || !c.exp || !getRefreshToken()) return;
        var wait = c.exp * 1000 - Date.now() - 60000;
        timer = setTimeout(function () {
            refresh().then(function (ok) {
                // network trouble: try again shortly (a rejected token clears the session instead)
                if (!ok && getRefreshToken()) timer = setTimeout(scheduleRefresh, 30000);
            });
        }, Math.max(wait, 5000));
    }

    // resolves to 'ok', 'invalid' (the auth service rejected the token) or 'error'
    function doRefresh(token) {
        return fetch(authUrl + '/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: token })
        }).then(function (response) {
            if (response.ok) {
                return response.json().then(function (data) {
                    setSession(data);
                    return 'ok';
                });
            }
            return response.status === 401 ? 'invalid' : 'error';
        }).catch(function () {
            return 'error';
        });
    }

    // refresh tokens rotate, so only one refresh may run at a time
    function refresh() {
        if (inflight) return inflight;
        var used = getRefreshToken();
        if (!used) return Promise.resolve(false);
        inflight = doRefresh(used).then(function (result) {
            if (result === 'invalid') {
                // another tab may have just rotated it and already stored fresh tokens
                var latest = getRefreshToken();
                if (latest && latest !== used) {
                    result = 'ok';
                } else {
                    clearSession();
                }
            }
            inflight = null;
            return result === 'ok';
        });
        return inflight;
    }

    // Called once per page. Resolves to { loggedIn, reloadNeeded }.
    // reloadNeeded means the page loaded with no usable token and we had to get
    // a new one, so scripts that already ran as "logged out" should run again.
    function ensure() {
        var now = Date.now() / 1000;
        var c = claims();
        var valid = !!(c && c.exp && c.exp > now);
        if (valid && c.exp - now > 60) {
            scheduleRefresh();
            return Promise.resolve({ loggedIn: true, reloadNeeded: false });
        }
        if (!getRefreshToken()) {
            return Promise.resolve({ loggedIn: valid, reloadNeeded: false });
        }
        return refresh().then(function (ok) {
            return { loggedIn: ok || valid, reloadNeeded: ok && !valid };
        });
    }

    // fetch with the bearer token; if it was rejected, refresh once and retry
    function authFetch(url, options) {
        options = options || {};
        function attempt() {
            var headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + getToken() });
            return fetch(url, Object.assign({}, options, { headers: headers }));
        }
        return attempt().then(function (response) {
            if (response.status !== 401) return response;
            return refresh().then(function (ok) {
                return ok ? attempt() : response;
            });
        });
    }

    function logout() {
        var token = getRefreshToken();
        function finish() {
            clearSession();
            window.location.href = '/';
        }
        if (!token) {
            finish();
            return;
        }
        var request = fetch(authUrl + '/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: token })
        });
        // don't leave the person stuck if the auth service is slow or down
        var giveUp = new Promise(function (resolve) { setTimeout(resolve, 3000); });
        Promise.race([request, giveUp]).then(finish, finish);
    }

    window.CFF = {
        authUrl: authUrl,
        getToken: getToken,
        claims: claims,
        userId: userId,
        setSession: setSession,
        clearSession: clearSession,
        refresh: refresh,
        ensure: ensure,
        authFetch: authFetch,
        logout: logout
    };
})();
