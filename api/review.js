export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { code, language } = req.body || {};

    if (!code || typeof code !== "string") {
      return res.status(400).json({
        error: "Please provide code to review."
      });
    }

    if (!language || typeof language !== "string") {
      return res.status(400).json({
        error: "Please select a programming language."
      });
    }

    const allowedLanguages = [
      "Python",
      "JavaScript",
      "Java",
      "C#",
      "C++",
      "SQL"
    ];

    if (!allowedLanguages.includes(language)) {
      return res.status(400).json({
        error: "Unsupported programming language."
      });
    }

    if (code.length > 12000) {
      return res.status(400).json({
        error: "Code is too long."
      });
    }

    const hfToken = process.env.HF_TOKEN;

    if (!hfToken) {
      return res.status(500).json({
        error: "HF_TOKEN is missing in Vercel Production."
      });
    }

    const prompt = `You are an expert ${language} developer and code reviewer.

Review the following ${language} code.

Identify genuine bugs only.
Do not invent problems.
Preserve the original purpose of the code.

Return your answer using exactly this format:

SUMMARY:
Explain the problem briefly.

ISSUES:
List genuine bugs found.
If there are no genuine bugs, say:
No genuine bugs found.

SUGGESTIONS:
List important improvements only when appropriate.

CODE:
${code}`;

    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          model: "Qwen/Qwen3-Coder-480B-A35B-Instruct",

          messages: [
            {
              role: "user",
              content: prompt
            }
          ],

          max_tokens: 4096,
          temperature: 0.1
        })
      }
    );

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        error: responseText
      };
    }

    if (!response.ok) {
      console.error(
        "Hugging Face Review error:",
        response.status,
        data
      );

      return res.status(response.status).json({
        error:
          data?.error ||
          data?.message ||
          `Hugging Face request failed (${response.status}).`
      });
    }

    const result =
      data?.choices?.[0]?.message?.content?.trim();

    if (!result) {
      console.error(
        "Empty Hugging Face Review response:",
        data
      );

      return res.status(500).json({
        error: "Hugging Face returned an empty review."
      });
    }

    return res.status(200).json({
      success: true,
      result: result
    });

  } catch (error) {
    console.error(
      "Review API error:",
      error
    );

    return res.status(500).json({
      error:
        "AI review service error: " +
        (error?.message || "Unknown error")
    });
  }
}
