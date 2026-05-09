import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { teacherEmail, studentName, roomTopic, pdfBase64, summary } = await req.json();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const htmlBody = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #1d4ed8; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 20px;">🏫 다정초 분쟁조정위원회</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">AI 상담 요약 보고서</p>
  </div>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 24px; border-radius: 0 0 12px 12px;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px; font-weight: bold; color: #64748b; width: 80px;">학생</td>
        <td style="padding: 8px;">${studentName}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold; color: #64748b;">상담 주제</td>
        <td style="padding: 8px;">${roomTopic}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold; color: #64748b;">보고 일자</td>
        <td style="padding: 8px;">${today}</td>
      </tr>
    </table>
    <p style="color: #64748b; font-size: 14px;">
      상세 요약 보고서가 PDF 파일로 첨부되어 있습니다. 확인 후 적절한 조치를 취해 주세요.
    </p>
    <div style="margin-top: 20px; padding: 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #1e40af;">
        이 메일은 다정초 분쟁조정위원회 AI 상담 시스템에서 자동 발송되었습니다.
      </p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: teacherEmail,
      subject: `[분쟁조정위원회] ${studentName} 학생 AI 상담 요약 보고서 (${roomTopic})`,
      html: htmlBody,
      attachments: [
        {
          filename: `${studentName}_상담요약_${new Date().toISOString().slice(0, 10)}.pdf`,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json({ error: '이메일 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
