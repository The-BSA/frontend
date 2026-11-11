(function () {
    var main = document.getElementById('main');
    var apiUrl = main.dataset.apiUrl.replace(/\/+$/, '');

    var form = document.getElementById('search-form');
    var queryInput = document.getElementById('search-q');
    var filtersBox = document.getElementById('filters');
    var programSelect = document.getElementById('filter-program');
    var yearSelect = document.getElementById('filter-year');
    var orgSelect = document.getElementById('filter-org');
    var clearButton = document.getElementById('clear-filters');
    var statusEl = document.getElementById('status');
    var resultsEl = document.getElementById('results');
    var pagination = document.getElementById('pagination');
    var prevButton = document.getElementById('prev-page');
    var nextButton = document.getElementById('next-page');
    var pageInfo = document.getElementById('page-info');

    var currentPage = 1;
    var requestId = 0;

    function getToken() {
        var match = document.cookie.match(/(?:^|;\s*)session=([^;]+)/);
        return match ? match[1] : '';
    }

    function readUrl() {
        var params = new URLSearchParams(window.location.search);
        queryInput.value = params.get('q') || '';
        currentPage = parseInt(params.get('page'), 10) || 1;
        return {
            program: params.get('program') || '',
            graduation_year: params.get('graduation_year') || '',
            organization_id: params.get('organization_id') || ''
        };
    }

    function currentParams() {
        var params = new URLSearchParams();
        if (queryInput.value.trim()) params.set('q', queryInput.value.trim());
        if (programSelect.value) params.set('program', programSelect.value);
        if (yearSelect.value) params.set('graduation_year', yearSelect.value);
        if (orgSelect.value) params.set('organization_id', orgSelect.value);
        if (currentPage > 1) params.set('page', currentPage);
        return params;
    }

    function fillSelect(select, anyLabel, options, wanted) {
        select.replaceChildren();
        select.add(new Option(anyLabel, ''));
        options.forEach(function (option) {
            select.add(new Option(option.label, option.value));
        });
        var known = options.some(function (o) { return String(o.value) === String(wanted); });
        select.value = known ? String(wanted) : '';
    }

    function applyFilters(filters, wanted) {
        fillSelect(programSelect, 'Any program',
            filters.programs.map(function (p) { return { label: p, value: p }; }),
            wanted.program);
        fillSelect(yearSelect, 'Any year',
            filters.graduation_years.map(function (y) { return { label: String(y), value: y }; }),
            wanted.graduation_year);
        fillSelect(orgSelect, 'Any organization',
            filters.organizations.map(function (o) { return { label: o.name, value: o.id }; }),
            wanted.organization_id);
    }

    function setLoggedIn(loggedIn, message) {
        filtersBox.disabled = !loggedIn;
    }

    // ----- rendering -----
    function initials(name) {
        // first letter of up to two words, ignoring digits and symbols
        var letters = name.split(/\s+/).map(function (word) {
            var match = word.match(/\p{L}/u);
            return match ? match[0] : '';
        }).filter(Boolean).slice(0, 2).join('');
        return letters.toUpperCase() || '?';
    }

    function makeAvatar(profile) {
        var url = profile.avatar_url || '';
        function fallback() {
            var span = document.createElement('span');
            span.className = 'avatar avatar-initials';
            span.setAttribute('aria-hidden', 'true');
            span.textContent = initials(profile.display_name);
            return span;
        }
        // avatar_url is user supplied: only plain web images are allowed
        if (!/^https?:\/\//i.test(url)) return fallback();
        var img = document.createElement('img');
        img.className = 'avatar';
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.src = url;
        img.addEventListener('error', function () { img.replaceWith(fallback()); });
        return img;
    }

    function addText(parent, tag, className, text) {
        if (!text) return;
        var el = document.createElement(tag);
        if (className) el.className = className;
        el.textContent = text;
        parent.appendChild(el);
    }

    function renderCard(profile, orgNames) {
        var card = document.createElement('li');
        card.className = 'student-card';

        var top = document.createElement('div');
        top.className = 'card-top';
        top.appendChild(makeAvatar(profile));
        addText(top, 'h2', '', profile.display_name);
        card.appendChild(top);

        var meta = [];
        if (profile.program) meta.push(profile.program);
        if (profile.graduation_year) meta.push('Class of ' + profile.graduation_year);
        addText(card, 'p', 'meta', meta.join(' · '));
        addText(card, 'p', '', profile.public_bio);
        if (profile.organization_access) {
            addText(card, 'p', '', profile.organization_bio);
            var names = (profile.shared_organization_ids || [])
                .map(function (id) { return orgNames[id]; })
                .filter(Boolean);
            if (names.length) {
                var chips = document.createElement('ul');
                chips.className = 'chips';
                chips.setAttribute('aria-label', 'Shared organizations');
                names.forEach(function (name) { addText(chips, 'li', '', name); });
                card.appendChild(chips);
            }
        }
        return card;
    }

    function render(data) {
        var orgNames = {};
        data.filters.organizations.forEach(function (o) { orgNames[o.id] = o.name; });
        resultsEl.replaceChildren.apply(resultsEl,
            data.results.map(function (p) { return renderCard(p, orgNames); }));

        if (data.total === 0) {
            statusEl.textContent = 'No students found. Try a different name or clear the filters.';
        } else {
            var first = (data.page - 1) * data.per_page + 1;
            var last = first + data.results.length - 1;
            statusEl.textContent = data.results.length
                ? 'Showing ' + first + '–' + last + ' of ' + data.total + ' students'
                : 'There are no students on this page.';
        }

        pagination.hidden = data.total_pages <= 1;
        pageInfo.textContent = 'Page ' + data.page + ' of ' + data.total_pages;
        prevButton.disabled = data.page <= 1;
        nextButton.disabled = data.page >= data.total_pages;
    }

    function request(params, token) {
        var headers = token ? { Authorization: 'Bearer ' + token } : {};
        return fetch(apiUrl + '/search?' + params.toString(), { headers: headers });
    }

    function load(wantedFilters) {
        var thisRequest = ++requestId;
        var params = currentParams();
        var token = getToken();
        statusEl.textContent = 'Searching…';

        var expired = false;
        request(params, token)
            .then(function (response) {
                if (response.status === 401 && token) {
                    // stale or invalid login: fall back to a public search
                    expired = true;
                    ['program', 'graduation_year', 'organization_id'].forEach(function (key) {
                        params.delete(key);
                    });
                    return request(params, '');
                }
                return response;
            })
            .then(function (response) {
                if (!response.ok) throw new Error('Search failed: ' + response.status);
                return response.json();
            })
            .then(function (data) {
                if (thisRequest !== requestId) return; // a newer search replaced this one
                applyFilters(data.filters, wantedFilters || {
                    program: programSelect.value,
                    graduation_year: yearSelect.value,
                    organization_id: orgSelect.value
                });
                setLoggedIn(data.authenticated, expired
                    ? 'Your login has expired. Log in again to filter and see more details.'
                    : '');
                render(data);
            })
            .catch(function (error) {
                if (thisRequest !== requestId) return;
                console.error(error);
                resultsEl.replaceChildren();
                pagination.hidden = true;
                statusEl.textContent = 'Search is unavailable right now. Please try again in a moment.';
            });
    }

    function search(resetPage) {
        if (resetPage) currentPage = 1;
        var query = currentParams().toString();
        history.pushState(null, '', query ? '?' + query : window.location.pathname);
        load();
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        search(true);
    });
    [programSelect, yearSelect, orgSelect].forEach(function (select) {
        select.addEventListener('change', function () { search(true); });
    });
    clearButton.addEventListener('click', function () {
        programSelect.value = yearSelect.value = orgSelect.value = '';
        search(true);
    });
    prevButton.addEventListener('click', function () {
        currentPage = Math.max(1, currentPage - 1);
        search(false);
        statusEl.scrollIntoView({ block: 'start' });
    });
    nextButton.addEventListener('click', function () {
        currentPage += 1;
        search(false);
        statusEl.scrollIntoView({ block: 'start' });
    });
    window.addEventListener('popstate', function () { load(readUrl()); });

    // first load: browse everyone, or run the search from the navbar (?q=...)
    load(readUrl());
})();
