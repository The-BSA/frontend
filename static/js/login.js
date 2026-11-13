(function() {
    var errorMessage = document.getElementById('error-message');

    function login() {
        var options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: document.getElementById('email').value,
                password: document.getElementById('password').value
            })
        };
        fetch(CFF.authUrl + '/login', options)
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    errorMessage.textContent = 'Invalid email or password';
                    throw new Error('Unauthorized');
                }
                throw new Error('Network response was not ok ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            CFF.setSession(data);
            window.location.href = '/';
        })
        .catch(error => {
            console.error('Fetch error:', error);
        });
    }

    document.querySelector('.submit-btn').addEventListener('click', login);
})();
