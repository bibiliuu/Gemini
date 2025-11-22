import { GoogleGenAI, Type } from "@google/genai";
import { TransactionRaw } from "../types";

const cleanName = (name: string | undefined): string => {
  if (!name) return "未知";
  if (name.trim() === "无" || name.trim() === "None") return "无";

  // REQUIREMENT: Exclude content inside parentheses completely.
  // Replace (...) and （...） with empty string BEFORE splitting.
  const nameWithoutParens = name.replace(/\([^)]*\)|（[^）]*）/g, '');

  // Split by explicit list separators: Comma, Slash, Pipe, or Newline.
  // NOTE: We do NOT split by space (\s) here to avoid breaking names like "Name A".
  // We rely on the AI prompt to convert visual spacing between DIFFERENT names into commas.
  const parts = nameWithoutParens.split(/[,，/|\n]+/);

  const cleanedParts = parts.map(part => {
      // Extract ONLY Chinese characters from this part
      // This removes emojis, numbers (unless inside parens which were already removed), and symbols.
      const matches = part.match(/[\u4e00-\u9fa5]+/g);
      return matches ? matches.join('') : '';
  }).filter(p => p.length > 0); // Remove empty parts

  if (cleanedParts.length === 0) return "";

  // Join back with comma to normalize the list for the app
  return cleanedParts.join(', ');
};

export const analyzeScreenshot = async (base64Image: string, mimeType: string): Promise<TransactionRaw> => {
  if (!process.env.API_KEY) {
    throw new Error("缺少 API Key");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze this WeChat screenshot containing an order form (下单表).
    
    Extract the following fields:
    1. Amount (from Item 5 [金额]). Return as a number.
    2. Taker Name (from Item 2 [接单]). 
       - TARGET: Extract ALL names found in this section.
       - BOUNDARY START: Immediately after "2 [接单]" or the number "2".
       - BOUNDARY END: The exact character before "3 [场控]" or the number "3".
       - STRICT RULE: Stop reading EXACTLY BEFORE the number "3" or the text "[场控]". Do NOT include the Controller's name from Item 3.
       - CRITICAL EDGE CASE (CROWDED TEXT): The last name usually touches the number "3" of the next line (e.g., "...屁屁3" or "...某某3"). You MUST capture the full name.
       - EXAMPLE: If the image shows "屁屁3", you MUST extract "屁屁". Do not truncate it to "屁". Capture ALL Chinese characters immediately preceding the "3".
       - OUTPUT FORMAT: Return a COMMA-SEPARATED list. (e.g. "Name1, Name2, Name3")
       - TRANSFORMATION: If names in the image are separated by spaces, newlines, or "@" symbols, replace them with COMMAS in your output.
       - CLEANING: Remove content inside parentheses if possible, or leave it for post-processing.
    3. Controller Name (from Item 3 [场控]).
    4. Superior Name (from Item 6 [直属]). If it says "无" or is missing, return "无".
    5. Order Date (from Item 8 [下单日期]). If the date is missing, empty, or unreadable, return an empty string "". Do not invent a date.
    6. Content (from Item 4 [点单内容]).

    Also generate a unique "orderId" string.
    
    Return the result in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: "Transaction amount" },
            taker: { type: Type.STRING, description: "All order takers, comma separated. Include everyone before item 3." },
            controller: { type: Type.STRING, description: "Name of the field controller (Chinese only)" },
            superior: { type: Type.STRING, description: "Name of the direct superior or '无'" },
            orderDate: { type: Type.STRING, description: "Date string from the screenshot, or empty string if missing" },
            content: { type: Type.STRING, description: "Description of the order" },
            orderId: { type: Type.STRING, description: "Generated unique signature" },
          },
          required: ["amount", "taker", "controller", "superior", "orderId"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 未返回数据");

    const data = JSON.parse(text);
    
    // Apply strict cleaning
    const rawTaker = data.taker || "未知";
    const rawController = data.controller || "未知";
    const rawSuperior = data.superior || "无";

    return {
      amount: data.amount || 0,
      orderId: data.orderId || `MANUAL-${Date.now()}`,
      taker: cleanName(rawTaker) || "未知",
      controller: cleanName(rawController) || "未知",
      superior: cleanName(rawSuperior) || "无",
      orderDate: data.orderDate || "", 
      content: data.content || ""
    };

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw error;
  }
};