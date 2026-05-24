import anthropic
import os
import json

client = anthropic.Anthropic(api_key=os.getenv('CLAUDE_API_KEY'))

MOOD_CHIPS = {
    'stressed': ['Work pressure', 'School stress', 'Family issues', 'Money problems', 'Relationship issues', 'Health concerns'],
    'sad':      ['Feeling lonely', 'Loss or grief', 'Rejection', 'Feeling lost', 'No specific reason', 'Missing someone'],
    'low':      ['Feeling tired', 'Unmotivated', 'Feeling empty', "Don't know why", 'Burnt out', 'Overwhelmed'],
    'calm':     ['Meditation', 'Good sleep', 'Exercise', 'Time with family', 'Nature walk', 'Creative activity'],
    'good':     ['Achieved something', 'Quality time', 'Good news', 'Self care', 'Productive day', 'Feeling grateful'],
}


def get_chips_for_mood(mood):
    return MOOD_CHIPS.get(mood.lower(), [])


def get_mood_followup(mood, user_name):
    """Get Claude's follow-up question after mood selection"""
    prompt = f"""You are Chomi, a warm and empathetic mental health companion for South Africans.
A user named {user_name} just selected their mood as: {mood}

Ask ONE short, warm, conversational follow-up question to understand more about how they're feeling.
Keep it under 2 sentences. Be gentle and non-clinical. Don't use bullet points."""

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=150,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text


def get_mood_response(mood, chip_selected, user_message, user_name, recent_history):
    """Get Claude's personalised response after user shares what's wrong"""
    history_context = ""
    if recent_history:
        history_context = f"Recent check-in history: {recent_history}"

    prompt = f"""You are Chomi, a warm and empathetic mental health companion for South Africans.

User: {user_name}
Mood selected: {mood}
Quick option they selected: {chip_selected}
What they said: {user_message}
{history_context}

Respond with:
1. A short empathetic acknowledgement (2-3 sentences)
2. A gentle insight into why they might be feeling this way
3. 2-3 practical suggestions as short bullet points

Keep the tone warm, conversational and South African friendly.
Never be clinical or preachy. If they mention substances, gently ask what and why without judging.
Total response should be under 150 words."""

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text


def detect_topics(mood, chip_selected, user_message):
    """Detect topics from the check-in for research and personalisation"""
    prompt = f"""Extract mental health topics from this check-in.
Mood: {mood}
Selected: {chip_selected}
Message: {user_message}

Return ONLY a JSON array of topic strings. Maximum 4 topics.
Example: ["stress", "sleep", "work", "anxiety"]
No other text."""

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=50,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = message.content[0].text.strip()
    print(f"Topics raw response: {raw}")
    try:
        return json.loads(raw)
    except:
        return [mood]


def get_literacy_recommendations(user_name, topics):
    """Generate personalised literacy cards based on user's topics"""
    prompt = f"""You are Chomi. Generate 3 personalised mental health literacy cards for {user_name}.

Their recent topics: {', '.join(topics)}

Return ONLY a JSON array with this exact structure, no markdown, no code blocks:
[
  {{"title": "...", "summary": "...", "topic": "..."}},
  {{"title": "...", "summary": "...", "topic": "..."}},
  {{"title": "...", "summary": "...", "topic": "..."}}
]

Each summary must be 1-2 sentences, practical and warm.
Return ONLY the JSON array. Nothing else."""

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = message.content[0].text.strip()
    print(f"Literacy raw response: {raw}")

    # Strip markdown code blocks if present
    if raw.startswith('```'):
        lines = raw.split('\n')
        lines = [l for l in lines if not l.startswith('```')]
        raw = '\n'.join(lines).strip()

    try:
        result = json.loads(raw)
        print(f"Literacy parsed successfully: {len(result)} cards")
        return result
    except Exception as e:
        print(f"Literacy JSON parse error: {e}")
        print(f"Raw was: {raw}")
        return []