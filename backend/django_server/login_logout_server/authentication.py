from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

class AUTHENTICATION(JWTAuthentication):
    def authenticate(self, request):
        token_access = request.COOKIES.get('token_access')

        if not token_access:
            return None


        try:
            token_validated = self.get_validated_token(token_access.encode())
            user = self.get_user(token_validated)
        except AuthenticationFailed:
            return None
        return user, token_validated