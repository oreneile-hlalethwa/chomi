import os
import csv
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django_ratelimit.decorators import ratelimit
from .models import User, MoodCheckIn, LiteracyRecommendation, ChatMessage, Conversation, Message, EmergencyContact
from .claude_service import (
    get_chips_for_mood, get_mood_followup,
    get_mood_response, detect_topics,
    get_literacy_recommendations
)
import json
from datetime import timedelta, datetime
from django.utils import timezone
from django.db import models

def csrf_failure_view(request, reason=''):
    # Auto refresh once, show message if still failing
    retry = request.COOKIES.get('csrf_retry')
    if not retry:
        response = render(request, '403.html', status=403)
        response.set_cookie('csrf_retry', '1', max_age=30)
        response['Refresh'] = '0'  # auto refresh immediately
        return response
    else:
        response = render(request, '403.html', status=403)
        response.delete_cookie('csrf_retry')
        return response

# ── RATE LIMIT HELPER ──
def rate_limited_response(request, group=None, key=None):
    return JsonResponse({'error': 'Too many requests. Please slow down.'}, status=429)


@ratelimit(key='ip', rate='5/m', method='POST', block=True)
def login_view(request):
    if request.user.is_authenticated:
        if request.user.is_staff:
            return redirect('dashboard')
        return redirect('home')

    if request.method == 'POST':
        email    = request.POST.get('email')
        password = request.POST.get('password')
        user     = authenticate(request, username=email, password=password)

        if user is not None:
            login(request, user)
            if user.is_staff:
                return redirect('dashboard')
            return redirect('home')
        else:
            messages.error(request, 'Invalid email or password.')
            return render(request, 'login/index.html', {
                'show_auth':  True,
                'active_tab': 'signin',
            })

    return render(request, 'login/index.html')


@ratelimit(key='ip', rate='3/m', method='POST', block=True)
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
    return render(request, 'enduser/home.html', {'user': request.user})


@login_required(login_url='login')
def inbox_view(request):
    return render(request, 'enduser/inbox.html', {'user': request.user})


@login_required(login_url='login')
def reels_view(request):
    return render(request, 'enduser/reels.html')


@login_required(login_url='login')
def support_view(request):
    return render(request, 'enduser/support.html')


@login_required(login_url='login')
def profile_view(request):
    return render(request, 'enduser/profile.html', {'user': request.user})


@login_required(login_url='login')
def dashboard_view(request):
    if not request.user.is_staff:
        return redirect('home')
    return render(request, 'customer/landing.html', {'user': request.user})


@login_required(login_url='login')
def admin_portal_view(request):
    if not request.user.is_staff:
        return redirect('home')
    return render(request, 'customer/index.html', {'user': request.user})


@login_required(login_url='login')
def research_dashboard_view(request):
    if not request.user.is_staff:
        return redirect('home')
    return render(request, 'customer/dashboard.html', {'user': request.user})


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
@ratelimit(key='user', rate='10/m', block=True)
def submit_checkin(request):
    today = timezone.now().date()

    if MoodCheckIn.objects.filter(user=request.user, timestamp__date=today).exists():
        return JsonResponse({'error': 'Already checked in today'}, status=400)

    data         = json.loads(request.body)
    mood         = data.get('mood', '')
    chip         = data.get('chip_selected', '')
    user_message = data.get('user_message', '')

    recent = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__gte=timezone.now() - timedelta(days=7)
    ).values('mood', 'user_message')[:3]
    history = [f"{r['mood']}: {r['user_message']}" for r in recent]

    ai_response = get_mood_response(mood, chip, user_message, request.user.first_name, history)
    topics      = detect_topics(mood, chip, user_message)

    score_map = {'good': 5, 'calm': 4, 'stressed': 2, 'low': 2, 'sad': 1}
    MoodCheckIn.objects.create(
        user=request.user, mood=mood,
        mood_score=score_map.get(mood, 3),
        chip_selected=chip, user_message=user_message,
        ai_response=ai_response, topics=topics,
    )

    display_msg = f"{chip} — {user_message}" if chip and user_message else chip or user_message
    if display_msg:
        ChatMessage.objects.create(user=request.user, sender='user', message=display_msg)
    ChatMessage.objects.create(user=request.user, sender='chomi', message=ai_response)

    try:
        all_topics  = list(MoodCheckIn.objects.filter(user=request.user).values_list('topics', flat=True))
        flat_topics = list(set([t for sublist in all_topics for t in (sublist if isinstance(sublist, list) else [])]))[:5]
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
    today = timezone.now().date()
    days  = []
    for i in range(6, -1, -1):
        day     = today - timedelta(days=i)
        checkin = MoodCheckIn.objects.filter(user=request.user, timestamp__date=day).first()
        days.append({
            'day':   day.strftime('%a'),
            'score': checkin.mood_score if checkin else 0,
            'mood':  checkin.mood if checkin else None,
        })
    return JsonResponse({'history': days})


@login_required(login_url='login')
def get_literacy(request):
    recs = LiteracyRecommendation.objects.filter(user=request.user)[:4]
    data = [{'title': r.title, 'summary': r.summary, 'topic': r.topic} for r in recs]
    return JsonResponse({'recommendations': data})


@login_required(login_url='login')
@require_POST
@ratelimit(key='user', rate='20/m', block=True)
def continue_chat(request):
    data         = json.loads(request.body)
    user_message = data.get('user_message', '')

    recent = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__gte=timezone.now() - timedelta(days=7)
    ).values('mood', 'user_message', 'ai_response')[:3]
    history     = [f"{r['mood']}: {r['user_message']}" for r in recent]
    ai_response = get_mood_response('chat', '', user_message, request.user.first_name, history)

    ChatMessage.objects.create(user=request.user, sender='user',  message=user_message)
    ChatMessage.objects.create(user=request.user, sender='chomi', message=ai_response)
    return JsonResponse({'ai_response': ai_response})


@login_required(login_url='login')
def get_chat_history(request):
    today = timezone.now().date()
    msgs  = ChatMessage.objects.filter(user=request.user, timestamp__date=today)
    data  = [{'sender': m.sender, 'message': m.message, 'time': m.timestamp.strftime('%H:%M')} for m in msgs]
    return JsonResponse({'messages': data})


@login_required(login_url='login')
@ratelimit(key='user', rate='30/m', block=True)
def search_users(request):
    query = request.GET.get('q', '').strip()
    if len(query) < 1:
        return JsonResponse({'users': []})
    users = User.objects.filter(
        is_active=True, is_anonymous=False
    ).filter(
        models.Q(first_name__icontains=query) | models.Q(last_name__icontains=query)
    ).exclude(id=request.user.id)[:10]

    data = []
    for u in users:
        data.append({
            'id':          u.id,
            'name':        u.get_full_name(),
            'initials':    (u.first_name[0] + u.last_name[0]).upper(),
            'is_anon':     False,
            'is_verified': u.is_verified,
            'joined':      u.date_joined.strftime('%b %Y'),
            'email':       u.email,
        })
    return JsonResponse({'users': data})


@login_required(login_url='login')
def get_conversations(request):
    convos = request.user.conversations.prefetch_related('participants', 'messages').all()
    data = []
    for c in convos:
        other    = c.get_other_participant(request.user)
        last_msg = c.get_last_message()
        if not other or not last_msg:
            continue
        unread = c.messages.filter(read=False).exclude(sender=request.user).count()
        data.append({
            'id':          c.id,
            'other_id':    other.id,
            'name':        'Anonymous' if other.is_anonymous else other.get_full_name(),
            'initials':    'AN' if other.is_anonymous else (other.first_name[0] + other.last_name[0]).upper(),
            'is_anon':     other.is_anonymous,
            'is_verified': other.is_verified,
            'last_msg':    last_msg.content[:60],
            'time':        last_msg.timestamp.strftime('%H:%M'),
            'unread':      unread,
        })
    return JsonResponse({'conversations': data})


@login_required(login_url='login')
def get_messages(request, conversation_id):
    from django.shortcuts import get_object_or_404
    convo = get_object_or_404(Conversation, id=conversation_id, participants=request.user)
    convo.messages.filter(read=False).exclude(sender=request.user).update(read=True)
    msgs  = convo.messages.all()
    data  = [{'sender_id': m.sender.id, 'content': m.content, 'time': m.timestamp.strftime('%H:%M'), 'is_me': m.sender == request.user} for m in msgs]
    return JsonResponse({'messages': data})


@login_required(login_url='login')
@require_POST
@ratelimit(key='user', rate='20/m', block=True)
def send_message(request):
    from django.shortcuts import get_object_or_404
    data     = json.loads(request.body)
    other_id = data.get('other_id')
    content  = data.get('content', '').strip()
    convo_id = data.get('conversation_id')

    if not content:
        return JsonResponse({'error': 'Empty message'}, status=400)

    if convo_id:
        convo = get_object_or_404(Conversation, id=convo_id, participants=request.user)
    else:
        other    = get_object_or_404(User, id=other_id)
        existing = request.user.conversations.filter(participants=other)
        if existing.exists():
            convo = existing.first()
        else:
            convo = Conversation.objects.create()
            convo.participants.add(request.user, other)

    Message.objects.create(conversation=convo, sender=request.user, content=content)
    convo.save()
    return JsonResponse({'conversation_id': convo.id, 'status': 'sent'})


@login_required(login_url='login')
def get_user_profile(request, user_id):
    from django.shortcuts import get_object_or_404
    u        = get_object_or_404(User, id=user_id)
    checkins = MoodCheckIn.objects.filter(user=u).count()
    return JsonResponse({
        'id':          u.id,
        'name':        'Anonymous' if u.is_anonymous else u.get_full_name(),
        'initials':    'AN' if u.is_anonymous else (u.first_name[0] + u.last_name[0]).upper(),
        'is_anon':     u.is_anonymous,
        'is_verified': u.is_verified,
        'joined':      u.date_joined.strftime('%B %Y'),
        'checkins':    checkins,
        'email':       '' if u.is_anonymous else u.email,
    })


@login_required(login_url='login')
@require_POST
@ratelimit(key='user', rate='20/m', block=True)
def inbox_chomi_chat(request):
    data         = json.loads(request.body)
    user_message = data.get('message', '')
    recent = MoodCheckIn.objects.filter(
        user=request.user,
        timestamp__gte=timezone.now() - timedelta(days=7)
    ).values('mood', 'user_message')[:3]
    history     = [f"{r['mood']}: {r['user_message']}" for r in recent]
    ai_response = get_mood_response('chat', '', user_message, request.user.first_name, history)
    ChatMessage.objects.create(user=request.user, sender='user',  message=user_message)
    ChatMessage.objects.create(user=request.user, sender='chomi', message=ai_response)
    return JsonResponse({'response': ai_response})


@login_required(login_url='login')
@require_POST
def toggle_anonymous(request):
    data         = json.loads(request.body)
    is_anonymous = data.get('is_anonymous', True)
    request.user.is_anonymous = is_anonymous
    request.user.save()
    return JsonResponse({'is_anonymous': request.user.is_anonymous})


@login_required(login_url='login')
@require_POST
def update_profile(request):
    data         = json.loads(request.body)
    first_name   = data.get('first_name', '').strip()
    last_name    = data.get('last_name', '').strip()
    email        = data.get('email', '').strip()
    phone_number = data.get('phone_number', '').strip()

    if not first_name or not last_name or not email:
        return JsonResponse({'error': 'First name, last name and email are required.'}, status=400)

    if User.objects.filter(email=email).exclude(id=request.user.id).exists():
        return JsonResponse({'error': 'That email is already in use.'}, status=400)

    request.user.first_name   = first_name
    request.user.last_name    = last_name
    request.user.email        = email
    request.user.phone_number = phone_number
    request.user.save()
    return JsonResponse({'status': 'ok'})


@login_required(login_url='login')
@require_POST
def clear_data(request):
    data        = json.loads(request.body)
    clear_mood  = data.get('clear_mood', False)
    clear_chats = data.get('clear_chats', False)
    convo_ids   = data.get('convo_ids', [])

    if clear_mood:
        MoodCheckIn.objects.filter(user=request.user).delete()
        LiteracyRecommendation.objects.filter(user=request.user).delete()
        ChatMessage.objects.filter(user=request.user).delete()

    if clear_chats and convo_ids:
        convos = Conversation.objects.filter(id__in=convo_ids, participants=request.user)
        for convo in convos:
            convo.messages.all().delete()
            convo.delete()

    return JsonResponse({'status': 'ok'})


@login_required(login_url='login')
def get_emergency_contacts(request):
    contacts = EmergencyContact.objects.filter(user=request.user)
    data     = [{'id': c.id, 'name': c.name, 'phone': c.phone} for c in contacts]
    return JsonResponse({'contacts': data})


@login_required(login_url='login')
@require_POST
def add_emergency_contact(request):
    data  = json.loads(request.body)
    name  = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    if not name or not phone:
        return JsonResponse({'error': 'Name and phone are required.'}, status=400)
    contact = EmergencyContact.objects.create(user=request.user, name=name, phone=phone)
    return JsonResponse({'status': 'ok', 'id': contact.id})


@login_required(login_url='login')
@require_POST
def delete_emergency_contact(request, contact_id):
    from django.shortcuts import get_object_or_404
    contact = get_object_or_404(EmergencyContact, id=contact_id, user=request.user)
    contact.delete()
    return JsonResponse({'status': 'ok'})


# ══════════════════════════════
# ADMIN VIEWS
# ══════════════════════════════

@login_required(login_url='login')
def admin_stats(request):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Forbidden'}, status=403)

    # ── DATE RANGE from query param ──
    days_param = int(request.GET.get('days', 30))
    today      = timezone.now().date()
    period_start     = today - timedelta(days=days_param)
    prev_period_start = today - timedelta(days=days_param * 2)

    non_staff = User.objects.filter(is_staff=False)

    # ── CURRENT PERIOD COUNTS ──
    total_accounts  = non_staff.count()
    active_users    = non_staff.filter(is_active=True).count()
    total_checkins  = MoodCheckIn.objects.count()

    # Accounts in current vs previous period
    accounts_curr = non_staff.filter(date_joined__date__gte=period_start).count()
    accounts_prev = non_staff.filter(date_joined__date__gte=prev_period_start, date_joined__date__lt=period_start).count()

    # Active users (checked in) current vs previous
    active_curr = MoodCheckIn.objects.filter(timestamp__date__gte=period_start).values('user').distinct().count()
    active_prev = MoodCheckIn.objects.filter(timestamp__date__gte=prev_period_start, timestamp__date__lt=period_start).values('user').distinct().count()

    # Check-ins current vs previous
    checkins_curr = MoodCheckIn.objects.filter(timestamp__date__gte=period_start).count()
    checkins_prev = MoodCheckIn.objects.filter(timestamp__date__gte=prev_period_start, timestamp__date__lt=period_start).count()

    # ── PERCENTAGE CHANGE HELPER ──
    def pct_change(curr, prev):
        if prev == 0:
            return '+100%' if curr > 0 else '0%'
        change = round(((curr - prev) / prev) * 100, 1)
        return f'+{change}%' if change >= 0 else f'{change}%'

    accounts_change  = pct_change(accounts_curr, accounts_prev)
    active_change    = pct_change(active_curr, active_prev)
    checkins_change  = pct_change(checkins_curr, checkins_prev)

    # ── AVG SESSION TIME (real) ──
    # Estimate from chat messages: avg messages per user per day * 2 min
    msgs_period = ChatMessage.objects.filter(
        timestamp__date__gte=period_start, sender='user'
    )
    total_msgs   = msgs_period.count()
    active_days  = days_param
    msgs_per_day = total_msgs / active_days if active_days > 0 else 0
    avg_session_mins = round(msgs_per_day * 2)

    # Previous period avg session
    msgs_prev_period = ChatMessage.objects.filter(
        timestamp__date__gte=prev_period_start,
        timestamp__date__lt=period_start,
        sender='user'
    ).count()
    prev_avg = round((msgs_prev_period / active_days) * 2) if active_days > 0 else 0
    session_diff = avg_session_mins - prev_avg
    session_change = f'+{session_diff} min' if session_diff >= 0 else f'{session_diff} min'

    # ── MOOD DISTRIBUTION ──
    mood_dist = {}
    for mood, _ in MoodCheckIn.MOOD_CHOICES:
        mood_dist[mood] = MoodCheckIn.objects.filter(
            mood=mood, timestamp__date__gte=period_start
        ).count()

    # ── SIGNUPS OVER PERIOD ──
    signups = []
    for i in range(days_param - 1, -1, -1):
        day   = today - timedelta(days=i)
        count = non_staff.filter(date_joined__date=day).count()
        signups.append({'label': day.strftime('%d %b'), 'count': count})

    # ── ACTIVE BY DAY OF WEEK ──
    day_names     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    active_by_day = [0] * 7
    checkins_period = MoodCheckIn.objects.filter(timestamp__date__gte=period_start)
    for c in checkins_period:
        active_by_day[c.timestamp.weekday()] += 1
    active_by_day_data = [{'day': day_names[i], 'count': active_by_day[i]} for i in range(7)]

    # ── SCREEN TIME LAST 7 DAYS ──
    screen_time = []
    for i in range(6, -1, -1):
        day   = today - timedelta(days=i)
        count = ChatMessage.objects.filter(timestamp__date=day, sender='user').count()
        screen_time.append({'day': day.strftime('%a'), 'mins': count * 2})

    # ── NEW VS RETURNING ──
    new_vs_returning = []
    for i in range(5, -1, -1):
        month_start = (today.replace(day=1) - timedelta(days=i*30)).replace(day=1)
        month_end   = (month_start + timedelta(days=32)).replace(day=1)
        new_users   = non_staff.filter(date_joined__date__gte=month_start, date_joined__date__lt=month_end).count()
        returning   = MoodCheckIn.objects.filter(
            timestamp__date__gte=month_start, timestamp__date__lt=month_end
        ).values('user').distinct().exclude(user__date_joined__date__gte=month_start).count()
        new_vs_returning.append({'label': month_start.strftime('%b'), 'new': new_users, 'returning': returning})

    # ── RETENTION ──
    retention = []
    for i in range(11, -1, -1):
        week_start = today - timedelta(days=today.weekday() + i*7)
        week_end   = week_start + timedelta(days=7)
        users_that_week = MoodCheckIn.objects.filter(timestamp__date__gte=week_start, timestamp__date__lt=week_end).values('user').distinct().count()
        returned_next   = MoodCheckIn.objects.filter(timestamp__date__gte=week_end, timestamp__date__lt=week_end + timedelta(days=7)).values('user').distinct().count()
        rate = round((returned_next / users_that_week * 100) if users_that_week else 0)
        retention.append({'label': week_start.strftime('%d %b'), 'rate': rate})

    # ── STREAK DISTRIBUTION ──
    streak_buckets = {'1 day': 0, '2-3': 0, '4-7': 0, '8-14': 0, '15-30': 0, '30+': 0}
    for u in non_staff:
        streak = 0
        for j in range(30):
            day = today - timedelta(days=j)
            if MoodCheckIn.objects.filter(user=u, timestamp__date=day).exists():
                streak += 1
            else:
                break
        if streak == 1:    streak_buckets['1 day'] += 1
        elif streak <= 3:  streak_buckets['2-3']   += 1
        elif streak <= 7:  streak_buckets['4-7']   += 1
        elif streak <= 14: streak_buckets['8-14']  += 1
        elif streak <= 30: streak_buckets['15-30'] += 1
        elif streak > 30:  streak_buckets['30+']   += 1

    total_with_streak = sum(streak_buckets.values()) or 1
    streak_dist = [{'label': k, 'pct': round(v / total_with_streak * 100)} for k, v in streak_buckets.items()]

    # ── SUPPORT VISITS ──
    support_visits = ChatMessage.objects.filter(
        message__icontains='support', timestamp__date__gte=period_start
    ).values('user').distinct().count()

    # ── RETENTION RATE ──
    week_ago        = today - timedelta(days=7)
    users_last_week = MoodCheckIn.objects.filter(timestamp__date__gte=week_ago).values('user').distinct().count()
    users_two_weeks = MoodCheckIn.objects.filter(timestamp__date__gte=today - timedelta(days=14), timestamp__date__lt=week_ago).values('user').distinct().count()
    retention_rate  = str(round((users_last_week / users_two_weeks * 100) if users_two_weeks else 0)) + '%'

    # ── GENDER DISTRIBUTION ──
    gender_labels = {'female': 'Female', 'male': 'Male', 'non_binary': 'Non-binary', 'prefer_not': 'Prefer not to say', '': 'Not specified'}
    gender_counts = {}
    for code, label in gender_labels.items():
        count = non_staff.filter(gender=code).count()
        if count > 0:
            gender_counts[label] = count

    anon_count   = non_staff.filter(is_anonymous=True).count()
    public_count = non_staff.filter(is_anonymous=False).count()

    return JsonResponse({
        'total_accounts':      total_accounts,
        'active_users':        active_users,
        'total_checkins':      total_checkins,
        'avg_session_mins':    avg_session_mins,
        'support_visits':      support_visits,
        'retention_rate':      retention_rate,
        # Real percentage changes
        'accounts_change':     accounts_change,
        'active_change':       active_change,
        'checkins_change':     checkins_change,
        'session_change':      session_change,
        'accounts_up':         accounts_curr >= accounts_prev,
        'active_up':           active_curr >= active_prev,
        'checkins_up':         checkins_curr >= checkins_prev,
        'session_up':          session_diff >= 0,
        # Charts
        'mood_distribution':   mood_dist,
        'signups_over_time':   signups,
        'active_by_day':       active_by_day_data,
        'screen_time':         screen_time,
        'new_vs_returning':    new_vs_returning,
        'retention':           retention,
        'streak_dist':         streak_dist,
        'gender_distribution': gender_counts,
        'anon_count':          anon_count,
        'public_count':        public_count,
        'days':                days_param,
    })


@login_required(login_url='login')
def admin_users(request):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Forbidden'}, status=403)

    users = User.objects.filter(is_staff=False).order_by('-date_joined')
    data  = []

    for u in users:
        checkins     = MoodCheckIn.objects.filter(user=u).count()
        last_checkin = MoodCheckIn.objects.filter(user=u).first()

        streak = 0
        today  = timezone.now().date()
        for i in range(30):
            day = today - timedelta(days=i)
            if MoodCheckIn.objects.filter(user=u, timestamp__date=day).exists():
                streak += 1
            else:
                break

        if last_checkin:
            delta = (today - last_checkin.timestamp.date()).days
            if delta == 0:   last_active = 'Today'
            elif delta == 1: last_active = 'Yesterday'
            else:            last_active = f'{delta} days ago'
        else:
            last_active = 'Never'

        initials = (u.first_name[0] + u.last_name[0]).upper() if u.first_name and u.last_name else '??'

        data.append({
            'id':           u.id,
            'first_name':   u.first_name,
            'last_name':    u.last_name,
            'email':        u.email,
            'initials':     initials,
            'is_active':    u.is_active,
            'is_anonymous': u.is_anonymous,
            'is_verified':  u.is_verified,
            'date_joined':  u.date_joined.strftime('%b %Y'),
            'checkins':     checkins,
            'streak':       streak,
            'last_active':  last_active,
        })

    return JsonResponse({'users': data})


@login_required(login_url='login')
@require_POST
def admin_verify_user(request, user_id):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Forbidden'}, status=403)

    from django.shortcuts import get_object_or_404
    u = get_object_or_404(User, id=user_id)
    u.is_verified = not u.is_verified
    u.save()
    return JsonResponse({'is_verified': u.is_verified})


@login_required(login_url='login')
def journal_view(request):
    return render(request, 'enduser/journal.html', {'user': request.user})


@login_required(login_url='login')
def get_journal_entries(request):
    entries = JournalEntry.objects.filter(user=request.user)[:30]
    data = [{
        'id':         e.id,
        'content':    e.content,
        'mood':       e.mood,
        'prompt':     e.prompt,
        'word_count': e.word_count,
        'date':       e.created_at.strftime('%d %B %Y'),
        'time':       e.created_at.strftime('%H:%M'),
        'short_date': e.created_at.strftime('%d %b'),
    } for e in entries]
    return JsonResponse({'entries': data})


@login_required(login_url='login')
@require_POST
@ratelimit(key='user', rate='20/m', block=True)
def save_journal_entry(request):
    data       = json.loads(request.body)
    content    = data.get('content', '').strip()
    entry_id   = data.get('id')

    if not content:
        return JsonResponse({'error': 'Content is required.'}, status=400)

    word_count = len(content.split())
    today   = timezone.now().date()
    checkin = MoodCheckIn.objects.filter(user=request.user, timestamp__date=today).first()
    mood    = checkin.mood if checkin else ''

    if entry_id:
        from django.shortcuts import get_object_or_404
        entry = get_object_or_404(JournalEntry, id=entry_id, user=request.user)
        entry.content    = content
        entry.word_count = word_count
        entry.save()
    else:
        entry = JournalEntry.objects.create(
            user=request.user,
            content=content,
            mood=mood,
            word_count=word_count,
        )

    return JsonResponse({
        'status': 'ok',
        'id':     entry.id,
        'date':   entry.created_at.strftime('%d %B %Y'),
    })


@login_required(login_url='login')
@require_POST
def delete_journal_entry(request, entry_id):
    from django.shortcuts import get_object_or_404
    entry = get_object_or_404(JournalEntry, id=entry_id, user=request.user)
    entry.delete()
    return JsonResponse({'status': 'ok'})


@login_required(login_url='login')
def get_journal_prompt(request):
    today   = timezone.now().date()
    checkin = MoodCheckIn.objects.filter(user=request.user, timestamp__date=today).first()
    mood    = checkin.mood if checkin else None

    import random
    prompts = {
        'stressed': [
            "What\'s been weighing on you the most today? Write it all out.",
            "What would you tell a friend who was feeling exactly how you feel right now?",
            "What\'s one small thing you can do tonight to feel a little lighter?",
        ],
        'sad': [
            "What\'s making you feel sad today? You don\'t have to hold it in.",
            "What\'s something that used to make you happy that you haven\'t done in a while?",
            "Who is someone you trust that you could reach out to today?",
        ],
        'low': [
            "What does \'low\' feel like for you today — in your body, your thoughts?",
            "What\'s one thing, however small, that went okay today?",
            "What would tomorrow look like if it was just 10% better than today?",
        ],
        'calm': [
            "What\'s brought you peace today? Capture this feeling.",
            "What are three things you\'re grateful for right now?",
            "What does your ideal calm day look like?",
        ],
        'good': [
            "What\'s making today feel good? Write it down so you can remember it.",
            "What have you done recently that you\'re proud of?",
            "What\'s something you\'re looking forward to?",
        ],
    }

    if mood and mood in prompts:
        prompt = random.choice(prompts[mood])
    else:
        general = [
            "How are you really feeling today, beneath the surface?",
            "What\'s on your mind that you haven\'t said out loud to anyone?",
            "What does your ideal version of tomorrow look like?",
            "What\'s one thing you want to remember about today?",
        ]
        prompt = random.choice(general)

    return JsonResponse({'prompt': prompt, 'mood': mood})

@login_required(login_url='login')
def export_admin_csv(request):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Forbidden'}, status=403)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="chomi_users_export.csv"'

    writer = csv.writer(response)
    writer.writerow(['First Name', 'Last Name', 'Email', 'Gender', 'Date Joined', 'Is Active', 'Is Anonymous', 'Is Verified', 'Total Check-ins', 'Streak', 'Last Active'])

    today     = timezone.now().date()
    non_staff = User.objects.filter(is_staff=False).order_by('-date_joined')

    for u in non_staff:
        checkins     = MoodCheckIn.objects.filter(user=u).count()
        last_checkin = MoodCheckIn.objects.filter(user=u).first()

        streak = 0
        for i in range(30):
            day = today - timedelta(days=i)
            if MoodCheckIn.objects.filter(user=u, timestamp__date=day).exists():
                streak += 1
            else:
                break

        if last_checkin:
            delta = (today - last_checkin.timestamp.date()).days
            if delta == 0:   last_active = 'Today'
            elif delta == 1: last_active = 'Yesterday'
            else:            last_active = f'{delta} days ago'
        else:
            last_active = 'Never'

        writer.writerow([
            u.first_name,
            u.last_name,
            u.email,
            u.get_gender_display() if u.gender else 'Not specified',
            u.date_joined.strftime('%Y-%m-%d'),
            'Yes' if u.is_active else 'No',
            'Yes' if u.is_anonymous else 'No',
            'Yes' if u.is_verified else 'No',
            checkins,
            streak,
            last_active,
        ])

    return response


@login_required(login_url='login')
def export_research_csv(request):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Forbidden'}, status=403)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="chomi_research_export.csv"'

    writer = csv.writer(response)

    # Section 1: Mood Check-ins
    writer.writerow(['--- MOOD CHECK-INS ---'])
    writer.writerow(['Date', 'Mood', 'Mood Score', 'Topics'])
    checkins = MoodCheckIn.objects.all().order_by('-timestamp')
    for c in checkins:
        writer.writerow([
            c.timestamp.strftime('%Y-%m-%d'),
            c.mood,
            c.mood_score,
            ', '.join(c.topics) if isinstance(c.topics, list) else c.topics,
        ])

    writer.writerow([])

    # Section 2: Signups over time
    writer.writerow(['--- SIGNUPS OVER TIME ---'])
    writer.writerow(['Date', 'New Signups'])
    today     = timezone.now().date()
    non_staff = User.objects.filter(is_staff=False)
    for i in range(29, -1, -1):
        day   = today - timedelta(days=i)
        count = non_staff.filter(date_joined__date=day).count()
        writer.writerow([day.strftime('%Y-%m-%d'), count])

    writer.writerow([])

    # Section 3: Mood distribution
    writer.writerow(['--- MOOD DISTRIBUTION ---'])
    writer.writerow(['Mood', 'Count'])
    for mood, _ in MoodCheckIn.MOOD_CHOICES:
        count = MoodCheckIn.objects.filter(mood=mood).count()
        writer.writerow([mood, count])

    writer.writerow([])

    # Section 4: Gender distribution
    writer.writerow(['--- GENDER DISTRIBUTION ---'])
    writer.writerow(['Gender', 'Count'])
    gender_labels = {'female': 'Female', 'male': 'Male', 'non_binary': 'Non-binary', 'prefer_not': 'Prefer not to say', '': 'Not specified'}
    for code, label in gender_labels.items():
        count = non_staff.filter(gender=code).count()
        if count > 0:
            writer.writerow([label, count])

    return response