export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { code, language } = req.body || {};

    if (!code) {
      return res.status(400).json({
        error: "Code is missing."
      });
    }

    const hfToken = process.env.HF_TOKEN;

    if (!hfToken) {
      return res.status(500).json({
        error: "HF_TOKEN is missing in Vercel Production."
      });
    }

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
              content: `Fix this ${language} code and return the corrected code:\n\n${code}`
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        })
      }
    );

    const text = await response.text();

    return res.status(200).json({
      success: response.ok,
      httpStatus: response.status,
      huggingFaceResponse: text
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
