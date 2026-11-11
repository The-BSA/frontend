import os

from flask import Flask, render_template

app = Flask(__name__)

SEARCH_SERVICE_URL = os.getenv("SEARCH_SERVICE_URL", "http://localhost:5006")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/about-us")
def about():
    return render_template("about-us.html")

@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/signup")
def signup():
    return render_template("signup.html")

@app.route("/search")
def search():
    return render_template("search.html", search_service_url=SEARCH_SERVICE_URL)

@app.route("/profile")
def profile():
    return render_template("profile.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80, debug=True)