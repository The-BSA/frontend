(function () {
    var main = document.getElementById('main');
    var apiUrl = main.dataset.apiUrl.replace(/\/+$/, '');
    var token = main.dataset.token;

    var titleEl = document.getElementById('verify-title');
    var messageEl = document.getElementById('verify-message');
    var actionsEl = document.getElementById('verify-actions');

    function show(title, message) {
        document.title = title + ' | Cohort Friend Finder';
        titleEl.textContent = title;
        messageEl.textContent = message;
        actionsEl.hidden = false;
    }

    fetch(apiUrl + '/verify/' + encodeURIComponent(token))
        .then(function (response) {
            if (response.ok) {
                show('Email verified',
                    'Your school email is verified and you’ve joined its organization. ' +
                    'Students who share it can now see each other’s program, graduation year and organization bio.');
            } else if (response.status >= 500) {
                show('We couldn’t verify your email',
                    'Something went wrong on our side. Please open the link again in a moment.');
            } else {
                show('This link didn’t work',
                    'It may have expired or already been used. Open Settings to check your email’s ' +
                    'status, or send a new verification email.');
            }
        })
        .catch(function (error) {
            console.error(error);
            show('We couldn’t verify your email',
                'We couldn’t reach the organizations service. Please open the link again in a moment.');
        });
})();
