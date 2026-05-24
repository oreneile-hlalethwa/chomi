from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .models import User, MoodCheckIn, LiteracyRecommendation, ChatMessage
from .claude_service import (
    get_chips_for_mood, get_mood_followup,
    get_mood_response, detect_topics,
    get_literacy_recommendations
)
import json
from datetime import timedelta
from django.utils import timezone


def login_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        email    = request.POST.get('email')
        password = request.POST.get('password')
        user     = authenticate(request, username=email, password=password)

        if user is not None:
            login(request, user)
            return redirect('home')
        else:
            messages.error(request, 'Invalid email or password.')
            return render(request, 'login/index.html', {
                'show_auth':  True,
                'active_tab': 'signin',
            })

    return render(request, 'login/index.html')


def signup_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        first_name       = request.POST.get('first_name')
        last_name        = request.POST.get('last_name')
        email            = request.POST.get('email')
        phone_number     = request.POST.get('phone_number', '')
        gender           = request.POST.get('gender', '')
        password         = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')

        if password != confirm_password:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'login/index.html', {
                'show_auth':  True,
                'active_tab': 'signup',
            })

        if User.objects.filter(email=email).exists():
            messages.error(request, 'An account with this email already exists.')
            return render(request, 'login/index.html', {
                'show_auth':  True,
                'active_tab': 'signup',
            })

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone_number,
            gender=gender,
        )
        login(request, user)
        return redirect('home')

    return redirect('login')


def logout_view(request):
    logout(request)
    return redirect('login')


def forgot_password_view(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        if User.objects.filter(email=email).exists():
            messages.success(request, 'Password reset link sent to your email.')
        else:
            messages.error(request, 'No account found with that email.')
    return render(request, 'login/index.html', {
        'show_auth':  True,
        'active_tab': 'signin',
    })


@login_required(login_url='login')
def home_view(request):
    return render(request, 'enduser/home.html', {
        'user': request.user,
    })


@login_required(login_url='login')
def inbox_view(request):
    return render(request, 'enduser/inbox.html')


@login_required(login_url='login')
def reels_view(request):
    return render(request, 'enduser/reels.html')


@login_required(login_url='login')
def support_view(request):
    return render(request, 'enduser/support.html')


@login_required(login_url='login')
def profile_view(request):
    return render(request, 'enduser/profile.html', {
        'user': request.user,
    })


@login_required(login_url='login')
def get_mood_chips(request):
    mood  = request.GET.get('mood', '')
    today = timezone.now().date()

    already_checked_in = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__date=today
    ).exists()

    if already_checked_in:
        return JsonResponse({
            'already_checked_in': True,
            'message': "You've already logged your mood today — but I'm still here to chat!"
        })

    chips    = get_chips_for_mood(mood)
    followup = get_mood_followup(mood, request.user.first_name)
    return JsonResponse({
        'already_checked_in': False,
        'chips':    chips,
        'followup': followup,
    })


@login_required(login_url='login')
@require_POST
def submit_checkin(request):
    """Save check-in and return AI response"""
    today = timezone.now().date()

    # Block double submission
    if MoodCheckIn.objects.filter(user=request.user, timestamp__date=today).exists():
        return JsonResponse({'error': 'Already checked in today'}, status=400)

    data         = json.loads(request.body)
    mood         = data.get('mood', '')
    chip         = data.get('chip_selected', '')
    user_message = data.get('user_message', '')

    # Get recent history for context
    recent = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__gte=timezone.now() - timedelta(days=7)
    ).values('mood', 'user_message')[:3]
    history = [f"{r['mood']}: {r['user_message']}" for r in recent]

    # Get AI response
    ai_response = get_mood_response(
        mood, chip, user_message,
        request.user.first_name, history
    )

    # Detect topics
    topics = detect_topics(mood, chip, user_message)

    # Save check-in to database
    score_map = {'good': 5, 'calm': 4, 'stressed': 2, 'low': 2, 'sad': 1}
    MoodCheckIn.objects.create(
        user=request.user,
        mood=mood,
        mood_score=score_map.get(mood, 3),
        chip_selected=chip,
        user_message=user_message,
        ai_response=ai_response,
        topics=topics,
    )

    # Save chat messages for persistence
    display_msg = f"{chip} — {user_message}" if chip and user_message else chip or user_message
    if display_msg:
        ChatMessage.objects.create(user=request.user, sender='user',  message=display_msg)
    ChatMessage.objects.create(user=request.user, sender='chomi', message=ai_response)

    # Generate personalised literacy recommendations
    try:
        all_topics  = list(MoodCheckIn.objects.filter(
            user=request.user
        ).values_list('topics', flat=True))
        flat_topics = list(set([
            t for sublist in all_topics
            for t in (sublist if isinstance(sublist, list) else [])
        ]))[:5]

        if not flat_topics:
            flat_topics = [mood]

        recs = get_literacy_recommendations(request.user.first_name, flat_topics)
        LiteracyRecommendation.objects.filter(user=request.user).delete()
        for rec in recs:
            if isinstance(rec, dict):
                LiteracyRecommendation.objects.create(
                    user=request.user,
                    title=rec.get('title', ''),
                    summary=rec.get('summary', ''),
                    topic=rec.get('topic', ''),
                )
    except Exception as e:
        print(f"Literacy generation error: {e}")

    return JsonResponse({'ai_response': ai_response, 'topics': topics})


@login_required(login_url='login')
def get_mood_history(request):
    """Return mood scores for the past 7 days for the chart"""
    today = timezone.now().date()
    days  = []
    for i in range(6, -1, -1):
        day     = today - timedelta(days=i)
        checkin = MoodCheckIn.objects.filter(
            user=request.user,
            timestamp__date=day
        ).first()
        days.append({
            'day':   day.strftime('%a'),
            'score': checkin.mood_score if checkin else 0,
            'mood':  checkin.mood if checkin else None,
        })
    return JsonResponse({'history': days})


@login_required(login_url='login')
def get_literacy(request):
    """Return personalised literacy recommendations"""
    recs = LiteracyRecommendation.objects.filter(user=request.user)[:4]
    data = [{'title': r.title, 'summary': r.summary, 'topic': r.topic} for r in recs]
    return JsonResponse({'recommendations': data})


@login_required(login_url='login')
@require_POST
def continue_chat(request):
    """Continue chatting after mood check-in"""
    data         = json.loads(request.body)
    user_message = data.get('user_message', '')

    # Get recent check-in history for context
    recent = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__gte=timezone.now() - timedelta(days=7)
    ).values('mood', 'user_message', 'ai_response')[:3]
    history = [f"{r['mood']}: {r['user_message']}" for r in recent]

    ai_response = get_mood_response(
        'chat', '', user_message,
        request.user.first_name, history
    )

    # Save both messages for persistence
    ChatMessage.objects.create(user=request.user, sender='user',  message=user_message)
    ChatMessage.objects.create(user=request.user, sender='chomi', message=ai_response)

    return JsonResponse({'ai_response': ai_response})


@login_required(login_url='login')
def get_chat_history(request):
    """Return today's chat messages"""
    today    = timezone.now().date()
    msgs = ChatMessage.objects.filter(
        user=request.user,
        timestamp__date=today
    )
    data = [{'sender': m.sender, 'message': m.message, 'time': m.timestamp.strftime('%H:%M')} for m in msgs]
    return JsonResponse({'messages': data})