// שלוחת AI לימות המשיח – קובץ אחד בלבד: api/ivr.js (GitHub + Vercel). תומך ב-GET וב-POST (api_url_post=yes)
// המתקשר שואל בקול, ה-AI עונה, והמערכת מקריאה את התשובה.

const AI_URL = "https://text.pollinations.ai/"; // AI חינמי – לא צריך מפתח
const MAX_TURNS = 10; // כמה שאלות מותר בשיחה אחת
const SYSTEM =
  "אתה עוזר קולי בשלוחה טלפונית. ענה תמיד בעברית, בקצרה – עד שלושה משפטים. " +
  "בלי רשימות, בלי סימנים מיוחדים, בלי אמוג'י ובלי קישורים, כי התשובה מוקראת בקול.";

// ימות המשיח לא מקבלת את התווים האלה בטקסט להקראה
const clean = s => String(s || "")
  .replace(/[.\-"'&|,=*#_~`<>\[\](){}\\/\n\r]+/g, " ")
  .replace(/\s+/g, " ").trim().slice(0, 900);

// שאלה בקול: שם המשתנה, לא להשתמש בערך קיים, זיהוי דיבור, עברית, לא לחסום הקשה
const listen = (prompt, name) => `read=t-${clean(prompt)}=${name},no,voice,he-IL,no`;

async function askAI(questions) {
  const history = questions.slice(0, -1);
  const current = questions[questions.length - 1];
  const content = (history.length ? "שאלות קודמות בשיחה: " + history.join(" | ") + "\n\n" : "") +
    "השאלה עכשיו: " + current;
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content }]
    }),
    signal: AbortSignal.timeout(25000)
  });
  if (!r.ok) throw new Error("AI " + r.status);
  return (await r.text()).trim();
}

module.exports = async (req, res) => {
  const p = { ...(req.query || {}), ...(req.body && typeof req.body === "object" ? req.body : {}) };
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  if (p.ApiHangup) return res.send(""); // המתקשר ניתק

  // כל השאלות שנאספו עד עכשיו בשיחה: q1, q2, q3...
  const qs = [];
  for (let i = 1; p["q" + i] !== undefined; i++) qs.push(String([].concat(p["q" + i]).pop()).trim());
  const n = qs.length;

  if (n === 0) return res.send(listen("שלום וברוכים הבאים לשלוחת הבינה המלאכותית אחרי הצליל אמרו את שאלתכם", "q1"));
  if (!qs[n - 1]) return res.send(listen("לא שמעתי אנא אמרו את השאלה שוב", "q" + n));

  let answer;
  try {
    answer = clean(await askAI(qs)) || "לא הצלחתי למצוא תשובה";
  } catch (e) {
    answer = "סליחה יש תקלה זמנית בשירות הבינה המלאכותית נסו שוב בעוד רגע";
  }

  if (n >= MAX_TURNS) return res.send(`id_list_message=t-${answer}.t-תודה ולהתראות&go_to_folder=hangup`);
  res.send(`read=t-${answer}.t-לשאלה נוספת אמרו אותה אחרי הצליל=q${n + 1},no,voice,he-IL,no`);
};
