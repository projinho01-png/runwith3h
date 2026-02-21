require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// HTML 페이지 제공
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 인증 코드 저장소 (메모리)
const verificationCodes = new Map();

// Gmail SMTP 설정
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// 서버 상태 확인
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 인증 코드 발송
app.post('/api/send-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: '이메일이 필요합니다' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // 10분 후 만료
  verificationCodes.set(email, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  try {
    await transporter.sendMail({
      from: `"Run With 3H" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '[Run With 3H] 이메일 인증 코드',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #667eea;">Run With 3H 이메일 인증</h2>
          <p>아래 인증 코드를 입력해주세요:</p>
          <div style="background: #f7fafc; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #667eea;">${code}</span>
          </div>
          <p style="color: #718096; font-size: 13px;">이 코드는 10분간 유효합니다.</p>
        </div>
      `
    });

    console.log(`인증 코드 발송 완료: ${email}`);
    res.json({ message: '인증 코드가 발송되었습니다' });
  } catch (error) {
    console.error('이메일 발송 실패:', error);
    res.status(500).json({ error: '이메일 발송에 실패했습니다. SMTP 설정을 확인해주세요.' });
  }
});

// 인증 코드 확인
app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: '이메일과 인증 코드가 필요합니다' });
  }

  const stored = verificationCodes.get(email);

  if (!stored) {
    return res.status(400).json({ error: '인증 코드가 발송되지 않았거나 만료되었습니다' });
  }

  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(email);
    return res.status(400).json({ error: '인증 코드가 만료되었습니다. 다시 요청해주세요' });
  }

  if (stored.code !== code) {
    return res.status(400).json({ error: '인증 코드가 일치하지 않습니다' });
  }

  verificationCodes.delete(email);
  res.json({ message: '인증이 완료되었습니다', verified: true });
});

// SMTP 연결 확인
transporter.verify((error) => {
  if (error) {
    console.error('SMTP 연결 실패:', error.message);
  } else {
    console.log('SMTP 연결 성공');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Run With 3H 백엔드 서버 실행 중: http://localhost:${PORT}`);
  console.log(`상태 확인: http://localhost:${PORT}/health`);
});
