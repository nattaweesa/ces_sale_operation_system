import { useState, useRef, useEffect, useCallback } from "react";
import { Button, Input, Typography, Spin, Tag, Tooltip } from "antd";
import { SendOutlined, RobotOutlined, UserOutlined, ClearOutlined } from "@ant-design/icons";
import { aiChatApi } from "../api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const { Text } = Typography;
const { TextArea } = Input;

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "ตอนนี้มี Deal ที่อยู่ stage ไหนบ้าง และมีกี่ deal?",
  "Sales คนไหนมี Pipeline มากที่สุด?",
  "มี Deal ที่ Project Status เป็น Design, Bidding, Award อย่างละกี่ deal?",
  "ขอดู 5 Deal ล่าสุดที่อัปเดต",
  "สรุป Pipeline ของแต่ละ Sales ให้หน่อย",
];

function formatTime(d: Date): string {
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 style={{ fontSize: 18, margin: "0 0 8px", fontWeight: 700 }}>{children}</h1>,
        h2: ({ children }) => <h2 style={{ fontSize: 16, margin: "0 0 8px", fontWeight: 700 }}>{children}</h2>,
        h3: ({ children }) => <h3 style={{ fontSize: 15, margin: "0 0 6px", fontWeight: 700 }}>{children}</h3>,
        p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
        ul: ({ children }) => <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: "0 0 8px", paddingLeft: 18 }}>{children}</ol>,
        li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
        table: ({ children }) => (
          <div style={{ overflowX: "auto", marginBottom: 8 }}>
            <table style={{ borderCollapse: "collapse", minWidth: 520, width: "100%" }}>{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead style={{ background: "#e5e7eb" }}>{children}</thead>,
        th: ({ children }) => (
          <th
            style={{
              border: "1px solid #d1d5db",
              padding: "6px 8px",
              fontSize: 13,
              fontWeight: 700,
              textAlign: "left",
              whiteSpace: "nowrap",
            }}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ border: "1px solid #d1d5db", padding: "6px 8px", fontSize: 13, verticalAlign: "top" }}>{children}</td>
        ),
        code: ({ children }) => (
          <code style={{ background: "#e5e7eb", padding: "1px 4px", borderRadius: 4, fontSize: 12 }}>{children}</code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [idCounter, setIdCounter] = useState(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = {
        id: idCounter,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      // History = all messages before this one (max last 10 turns = 20 msgs)
      const historySlice = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg]);
      setIdCounter((c) => c + 2);
      setInput("");
      setLoading(true);

      try {
        const res = await aiChatApi.query({ message: trimmed, history: historySlice });
        const aiMsg: Message = {
          id: idCounter + 1,
          role: "assistant",
          content: res.data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err: unknown) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          "เกิดข้อผิดพลาด ไม่สามารถเชื่อมต่อ AI ได้";
        const errMsg: Message = {
          id: idCounter + 1,
          role: "assistant",
          content: `⚠️ ${detail}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
        setTimeout(() => textAreaRef.current?.focus(), 100);
      }
    },
    [loading, messages, idCounter],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 8px", borderBottom: "1px solid #e5e7eb", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RobotOutlined style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <div>
            <Text strong style={{ fontSize: 15 }}>CES AI Assistant</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>ถามข้อมูล Deal, Pipeline, Stage และ Project Status ในระบบได้เลย</Text>
          </div>
        </div>
        {messages.length > 0 && (
          <Tooltip title="ล้างการสนทนา">
            <Button size="small" icon={<ClearOutlined />} onClick={clearChat} type="text" />
          </Tooltip>
        )}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 2px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && !loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20, padding: "32px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RobotOutlined style={{ color: "#fff", fontSize: 32 }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <Text strong style={{ fontSize: 16, display: "block" }}>สวัสดี! ผม CES AI Assistant</Text>
              <Text type="secondary" style={{ fontSize: 13 }}>ถามได้เลยครับ เกี่ยวกับ Deal, Pipeline, Stage ภายใน CES และ Project Status</Text>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 600 }}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <Tag
                  key={q}
                  style={{ cursor: "pointer", padding: "6px 12px", fontSize: 12, borderRadius: 20, border: "1px solid #d1d5db", color: "#374151", background: "#f9fafb" }}
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: msg.role === "user" ? "#3b82f6" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {msg.role === "user" ? (
                <UserOutlined style={{ color: "#fff", fontSize: 14 }} />
              ) : (
                <RobotOutlined style={{ color: "#fff", fontSize: 14 }} />
              )}
            </div>

            {/* Bubble */}
            <div style={{ maxWidth: "75%" }}>
              <div
                style={{
                  background: msg.role === "user" ? "#3b82f6" : "#f3f4f6",
                  color: msg.role === "user" ? "#fff" : "#111827",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "10px 14px",
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {msg.role === "assistant" ? <AssistantMarkdown content={msg.content} /> : msg.content}
              </div>
              <Text type="secondary" style={{ fontSize: 11, marginTop: 3, display: "block", textAlign: msg.role === "user" ? "right" : "left", paddingLeft: msg.role === "user" ? 0 : 4 }}>
                {formatTime(msg.timestamp)}
              </Text>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RobotOutlined style={{ color: "#fff", fontSize: 14 }} />
            </div>
            <div style={{ background: "#f3f4f6", borderRadius: "18px 18px 18px 4px", padding: "10px 16px" }}>
              <Spin size="small" />
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>กำลังค้นหาข้อมูล...</Text>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 4 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <TextArea
            ref={textAreaRef as React.RefObject<HTMLTextAreaElement>}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="พิมพ์คำถามเกี่ยวกับ Deal, Pipeline, Stage... (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
            autoSize={{ minRows: 1, maxRows: 5 }}
            style={{ resize: "none", flex: 1, borderRadius: 12 }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{ borderRadius: 12, height: 40, paddingLeft: 16, paddingRight: 16 }}
          >
            ส่ง
          </Button>
        </div>
        <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 6, paddingLeft: 4 }}>
          AI ตอบเฉพาะข้อมูลในระบบ CES เท่านั้น • ข้อมูล real-time จากฐานข้อมูล
        </Text>
      </div>
    </div>
  );
}
