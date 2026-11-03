var signupUrl = "http://127.0.0.1:5000/signup"

function signup() {
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
    fetch(signupUrl, options)
    .then(response => {
        if (!response.ok) {
        throw new Error('Network response was not ok ' + response.status);
        }
        return response.json();
    })
    .then(data => console.log(data))
    .catch(error => console.error('Fetch error:', error));
}