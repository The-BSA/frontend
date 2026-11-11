import os

from flask import Flask, redirect, render_template

app = Flask(__name__)

SEARCH_SERVICE_URL = os.getenv("SEARCH_SERVICE_URL", "http://localhost:5006")
PROFILES_SERVICE_URL = os.getenv("PROFILES_SERVICE_URL", "http://localhost:5005")

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
def profile_index():
    # profiles are opened from search results, so send bare /profile there
    return redirect("/search")

@app.route("/profile/<user_id>")
def profile(user_id):
    return render_template(
        "profile.html",
        profiles_service_url=PROFILES_SERVICE_URL,
        user_id=user_id,
    )

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80, debug=True)