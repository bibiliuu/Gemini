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
  // Use relative path for proxy (works in dev and prod if configured correctly)
  // In dev, we might need to point to localhost:3000 if not using Vite proxy
  const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api/analyze' : '/api/analyze';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Image,
        mimeType
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();

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