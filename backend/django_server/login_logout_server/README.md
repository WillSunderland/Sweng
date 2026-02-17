## Login / Logout / Register Server Guide for front end team

Host :- http://127.0.0.1:8000

This guide will explain to front end how to use the django server for authentication all servers are prefixed
with:
    `/login_logout_server/`

**1) Register New User**
Endpoint :- /login_logout_server/register/
Method :- Post
Content Type :- application/JSON

**Request Body Example**
`{
    "username" : "JohnDoe",
    "email"    : "DoeJo@tcd.ie",
    "password" : "Doe'ssecurepassword124"
}`

**Response Example(success)**
`{
    "username" : "JohnDoe",
    "email"    : "DoeJo@tcd.ie"
    "password": "pbkdf2_sha256$1000000$YAEL6FGzMnoVMCcv1RRgEp$OzQXdH1D4/Bp8mFIKAdIKFcSOQ8hhEh3ZzrWhg24zhM="
}
`
Notes:
- This is a post Request
- HTTP 400 will return if not successful

**2) Login User**
Endpoint :- /login_logout_server/login/
Method :- POST
Content type :- application/JSON and HTML

**Request Body Example**
`{
    "username" : "JohnDoe",
    "password" : "Doe'ssecurepassword124"
}`

**Response Example(success)**
`{
  "success": true,
  "access": "<access_token>",
  "refresh": "<refresh_token>"
}`

**3) Refresh Access Token**
Endpoint :- /login_logout_server/token/refresh/
Method :- POST

Notes :-
- This endpoint reads the refresh_token cookie and returns a new access_token
- Returns JSON like this(success)
`{
  "refreshed": true,
}`

**4) Logout User**
Endpoint :- /login_logout_server/logout/
Method :- Post

**Request Body Example**
`{}`

**Response Example(success)**
`{
    "success": true
}`

**5) Authenticated**
Endpoint :-  /login_logout_server/authenticated/
Method :- GET

**Response Example(success)**
`{
    "username": "JohnDoe"
}`

This is all you need to know about the endpoints for the login_logout_server