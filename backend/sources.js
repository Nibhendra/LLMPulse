module.exports = [
  {
    name: "Anthropic / Claude",
    company: "Anthropic",
    category: "Claude",
    feedUrl: "https://rsshub.bestblogs.dev/anthropic/news",
    feedUrlFallback: [
      "https://rsshub.app/anthropic/news",
      "https://rsshub.moeyy.cn/anthropic/news"
    ],
    defaultTags: ["claude", "anthropic", "llm"]
  },
  {
    name: "OpenAI Newsroom",
    company: "OpenAI",
    category: "OpenAI",
    feedUrl: "https://openai.com/news/rss.xml",
    defaultTags: ["openai", "gpt", "llm"]
  },
  {
    name: "Google AI / Gemini",
    company: "Google",
    category: "Gemini",
    feedUrl: "https://blog.google/technology/ai/rss/",
    defaultTags: ["gemini", "google", "llm"]
  },
  {
    name: "Hugging Face Blog",
    company: "Hugging Face",
    category: "Hugging Face",
    feedUrl: "https://huggingface.co/blog/feed.xml",
    defaultTags: ["huggingface", "open-source", "models"]
  },
  {
    name: "LangChain Blog",
    company: "LangChain",
    category: "AI Coding Tools",
    feedUrl: "https://blog.langchain.dev/rss/",
    defaultTags: ["langchain", "agents", "framework"]
  },
  {
    name: "LlamaIndex Blog",
    company: "LlamaIndex",
    category: "AI Coding Tools",
    feedUrl: "https://medium.com/feed/llamaindex",
    defaultTags: ["llamaindex", "rag", "agents"]
  }
];
