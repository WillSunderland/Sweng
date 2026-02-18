from django.urls import path
from .views import (
    TodosGet,
    ObtainCustomTokenPairView,
    TokenCustomRefreshView,
    UserLogout,
    RegisterUser,
    IsUserLoggedIn,
)

urlpatterns = [
    path("login/", ObtainCustomTokenPairView.as_view(), name="token_obtain_pair"),
    path("logout/", UserLogout),
    path("token/refresh/", TokenCustomRefreshView.as_view(), name="token_refresh"),
    path("todos/", TodosGet),
    path("register/", RegisterUser),
    path("authenticated/", IsUserLoggedIn),
]
