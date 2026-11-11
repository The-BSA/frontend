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
        throw new Error('Network response was not ok ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        CFF.setSession(data);
        window.location.href = '/';
    })
    .catch(error => console.error('Fetch error:', error));
}