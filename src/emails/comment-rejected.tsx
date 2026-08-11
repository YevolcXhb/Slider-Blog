import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Link,
} from "react-email";

export interface CommentRejectedEmailProps {
  commentContent: string;
  postTitle: string;
  postUrl?: string;
  locale?: "zh" | "en";
}

export const CommentRejectedEmail = ({
  commentContent,
  postTitle,
  postUrl,
  locale = "zh",
}: CommentRejectedEmailProps) => {
  const isZh = locale === "zh";
  return (
    <Html>
      <Head />
      <Preview>{isZh ? "您的评论未通过审核" : "Your comment was not approved"}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f9fc", padding: "20px" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "0 auto",
            padding: "20px",
            borderRadius: "8px",
            maxWidth: "600px",
          }}
        >
          <Section>
            <Text style={{ fontSize: "24px", fontWeight: "bold", color: "#333" }}>
              {isZh ? "Slider Blog · 评论审核通知" : "Slider Blog · Comment Review Notice"}
            </Text>
            <Text style={{ color: "#666", lineHeight: "1.6" }}>
              {isZh
                ? "很抱歉，您的评论未通过管理员审核。以下是评论内容与对应文章："
                : "Unfortunately, your comment was not approved by the administrator. Here is the comment and the associated post:"}
            </Text>
            <Hr />
            <Text style={{ fontSize: "14px", color: "#999" }}>
              {isZh ? "评论内容" : "Comment"}
            </Text>
            <Text
              style={{
                padding: "12px",
                backgroundColor: "#f6f8fa",
                borderRadius: "6px",
                fontStyle: "italic",
              }}
            >
              {commentContent.length > 200
                ? commentContent.slice(0, 200) + "..."
                : commentContent}
            </Text>
            <Text style={{ fontSize: "14px", color: "#999", marginTop: "16px" }}>
              {isZh ? "对应文章" : "Post"}
            </Text>
            {postUrl ? (
              <Link href={postUrl} style={{ color: "#007bff", textDecoration: "underline" }}>
                {postTitle}
              </Link>
            ) : (
              <Text>{postTitle}</Text>
            )}
            <Hr />
            <Text style={{ fontSize: "12px", color: "#999" }}>
              {isZh
                ? "如果您认为这是误判，请回复此邮件与我们联系。"
                : "If you believe this is a mistake, please reply to this email."}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default CommentRejectedEmail;
