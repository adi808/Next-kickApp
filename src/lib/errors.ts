// Server errors (raised in the RPCs) shown in Hebrew.
const MESSAGES: Record<string, string> = {
  'this link is no longer active': 'הקישור כבר לא פעיל. בקשו קישור חדש מהמאמן.',
  'a request is already waiting for approval': 'כבר נשלחה בקשה והיא ממתינה לאישור.',
  'this phone number belongs to another account': 'מספר הטלפון כבר רשום בחשבון אחר.',
  'invalid birth date': 'תאריך לידה לא תקין.',
  'invalid child email': 'האימייל של הילד לא תקין.',
  "a child needs their own email, not the parent's": 'לילד צריך אימייל משלו, לא של ההורה.',
  'list one to six children': 'יש לרשום לפחות ילד אחד (עד שישה).',
  'every child needs a name': 'לכל ילד צריך שם.',
  'a name is required': 'צריך למלא שם.',
  'you are already on this team': 'אתם כבר רשומים בקבוצה.',
  'you are already on the team staff': 'אתם כבר בצוות הקבוצה.',
  'this email already belongs to another player': 'האימייל כבר משויך לשחקן אחר.',
  'invalid email': 'אימייל לא תקין.',
  'no pending request': 'הבקשה כבר טופלה.',
  'not allowed': 'אין הרשאה לפעולה הזו.',
};

export function heError(err: { message?: string } | null | undefined, fallback = 'הפעולה נכשלה. נסו שוב.'): string {
  return (err?.message && MESSAGES[err.message]) || fallback;
}
