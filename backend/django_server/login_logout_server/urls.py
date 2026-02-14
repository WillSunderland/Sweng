from django.urls import path
from .views import (TODOS_GET, OBTAIN_CUSTOM_TOKEN_PAIR_VIEW, TOKEN_CUSTOM_REFRESH_VIEWS
                    , USER_LOGOUT, REGISTER_USER, IS_USER_LOGGED_IN)

urlpatterns = [
    path('login/', OBTAIN_CUSTOM_TOKEN_PAIR_VIEW.as_view(), name='token_obtain_pair'),
    path('logout/', USER_LOGOUT),
    path('token/refresh/', TOKEN_CUSTOM_REFRESH_VIEWS.as_view(), name='token_refresh'),
    path('todos/', TODOS_GET),
    path('register/', REGISTER_USER),
    path('authenticated/', IS_USER_LOGGED_IN),
]