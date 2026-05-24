from django.urls import path
from . import views

urlpatterns = [
    path('',                 views.login_view,          name='login'),
    path('login-submit/',    views.login_view,          name='login_submit'),
    path('signup/',          views.signup_view,         name='signup'),
    path('logout/',          views.logout_view,         name='logout'),
    path('home/',           views.home_view,            name='home'),
    path('inbox/',          views.inbox_view,           name='inbox'),
    path('reels/',          views.reels_view,           name='reels'),
    path('support/',        views.support_view,         name='support'),
    path('profile/',        views.profile_view,         name='profile'),
    path('forgot-password/', views.forgot_password_view, name='forgot_password'),
    path('api/mood-chips/',    views.get_mood_chips,    name='mood_chips'),
    path('api/checkin/',       views.submit_checkin,    name='submit_checkin'),
    path('api/mood-history/',  views.get_mood_history,  name='mood_history'),
    path('api/literacy/',      views.get_literacy,      name='literacy'),
    path('api/chat/',           views.continue_chat,    name='continue_chat'),
    path('api/chat-history/', views.get_chat_history,   name='chat_history'),
]