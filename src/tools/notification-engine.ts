/**
 * Tool: send_notification
 *
 * Sends SMS and/or WhatsApp notifications to loan officers, checkers
 * and clients via Africa's Talking (primary — Uganda-optimized) or
 * Twilio (fallback).
 *
 * Key use case: when a note is written on a loan, the assigned
 * loan officer is notified instantly on WhatsApp/SMS with the note
 * content — no more manual searching through client lists.
 */
import axios from "axios";
import {
  NotificationPayload, NotificationResult, NotificationChannel, NotificationEvent
} from "../types/index.js";

// ─── Provider interfaces ────────────────────────────────────────────────────
interface SmsProvider {
  sendSms(phone: string, message: string): Promise<NotificationResult>;
}

interface WhatsAppProvider {
  sendWhatsApp(phone: string, message: string): Promise<NotificationResult>;
}

// ─── Africa's Talking provider ──────────────────────────────────────────────
class AfricasTalkingProvider implements SmsProvider, WhatsAppProvider {
  private apiKey  = process.env.AT_API_KEY    ?? "";
  private username = process.env.AT_USERNAME  ?? "sandbox";
  private senderId = process.env.AT_SENDER_ID ?? "NOVA";
  private waNumber = process.env.AT_WHATSAPP_NUMBER ?? "";
  private baseUrl = "https://api.africastalking.com/version1";

  async sendSms(phone: string, message: string): Promise<NotificationResult> {
    try {
      const resp = await axios.post(
        `${this.baseUrl}/messaging`,
        new URLSearchParams({
          username: this.username,
          to: phone,
          message,
          from: this.senderId,
        }).toString(),
        {
          headers: {
            apiKey: this.apiKey,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        }
      );
      const entry = resp.data?.SMSMessageData?.Recipients?.[0];
      return {
        success: entry?.status === "Success",
        channel: "sms",
        recipient: phone,
        messageId: entry?.messageId,
        cost: entry?.cost,
        error: entry?.status !== "Success" ? entry?.status : undefined,
      };
    } catch (err) {
      return { success: false, channel: "sms", recipient: phone, error: String(err) };
    }
  }

  async sendWhatsApp(phone: string, message: string): Promise<NotificationResult> {
    // Africa's Talking WhatsApp Business API
    try {
      const resp = await axios.post(
        "https://chat.africastalking.com/whatsapp/message/send",
        { phoneNumber: phone, message, username: this.username },
        {
          headers: {
            apiKey: this.apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );
      return {
        success: resp.data?.status === "success",
        channel: "whatsapp",
        recipient: phone,
        messageId: resp.data?.messageId,
        error: resp.data?.status !== "success" ? resp.data?.message : undefined,
      };
    } catch (err) {
      return { success: false, channel: "whatsapp", recipient: phone, error: String(err) };
    }
  }
}

// ─── Twilio WhatsApp fallback ───────────────────────────────────────────────
class TwilioProvider implements WhatsAppProvider {
  private sid   = process.env.TWILIO_ACCOUNT_SID ?? "";
  private token = process.env.TWILIO_AUTH_TOKEN  ?? "";
  private from  = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

  async sendWhatsApp(phone: string, message: string): Promise<NotificationResult> {
    try {
      const resp = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`,
        new URLSearchParams({
          From: this.from,
          To: `whatsapp:${phone}`,
          Body: message,
        }).toString(),
        {
          auth: { username: this.sid, password: this.token },
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
      return {
        success: resp.data?.status !== "failed",
        channel: "whatsapp",
        recipient: phone,
        messageId: resp.data?.sid,
        error: resp.data?.status === "failed" ? resp.data?.error_message : undefined,
      };
    } catch (err) {
      return { success: false, channel: "whatsapp", recipient: phone, error: String(err) };
    }
  }
}

// ─── Notification router ────────────────────────────────────────────────────
const at     = new AfricasTalkingProvider();
const twilio = new TwilioProvider();

export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];
  const ch: NotificationChannel = payload.channel
    ?? (process.env.DEFAULT_NOTIFICATION_CHANNEL as NotificationChannel)
    ?? "whatsapp";

  if (ch === "sms" || ch === "both") {
    results.push(await at.sendSms(payload.recipientPhone, payload.message));
  }
  if (ch === "whatsapp" || ch === "both") {
    let res = await at.sendWhatsApp(payload.recipientPhone, payload.message);
    if (!res.success) {
      // fallback to Twilio
      res = await twilio.sendWhatsApp(payload.recipientPhone, payload.message);
      res.messageId = `twilio-${res.messageId ?? "fallback"}`;
    }
    results.push(res);
  }
  return results;
}

// ─── Message templates ──────────────────────────────────────────────────────
export function buildMessage(event: NotificationEvent, data: Record<string, string>): string {
  const inst = process.env.INSTITUTION_NAME ?? "Nova Microfinance";
  const templates: Record<NotificationEvent, string> = {
    LOAN_NOTE_ADDED:
      `📋 *${inst}* | Action Required\n\nHi ${data.officerName},\n\nA note has been added to *${data.clientName}* (Loan: ${data.accountNo}):\n\n_"${data.note}"_\n\nAdded by: ${data.addedBy}\nDate: ${data.date}\n\nPlease log in and take action.`,

    CHECKER_ACTION_REQUIRED:
      `🔍 *${inst}* | Checker Review Needed\n\nHi ${data.checkerName},\n\nLoan *${data.accountNo}* (${data.clientName}) requires your review.\n\nStatus: ${data.status}\nNote: _"${data.note}"_\nSubmitted by: ${data.submittedBy}\n\nPlease review in the system.`,

    LOAN_APPROVED:
      `✅ *${inst}* | Loan Approved\n\nHi ${data.officerName},\n\n*${data.clientName}'s* loan of *UGX ${data.amount}* has been APPROVED.\nAccount: ${data.accountNo}\nApproved by: ${data.approvedBy}\n\nProceed with disbursement steps.`,

    LOAN_REJECTED:
      `❌ *${inst}* | Loan Rejected\n\nHi ${data.officerName},\n\n*${data.clientName}'s* loan application has been REJECTED.\nAccount: ${data.accountNo}\nReason: ${data.reason}\nBy: ${data.rejectedBy}`,

    LOAN_DISBURSED:
      `💰 *${inst}* | Loan Disbursed\n\nDear ${data.clientName},\n\nYour loan of *UGX ${data.amount}* has been disbursed.\nAccount: ${data.accountNo}\nFirst repayment: ${data.firstRepaymentDate}\n\nThank you for choosing ${inst}.`,

    LOAN_OVERDUE:
      `⚠️ *${inst}* | Overdue Alert\n\nHi ${data.officerName},\n\nClient *${data.clientName}* (${data.accountNo}) is ${data.daysOverdue} days overdue.\nAmount due: UGX ${data.amountDue}\n\nPlease contact the client immediately.`,

    PAYMENT_RECEIVED:
      `✅ *${inst}* | Payment Received\n\nDear ${data.clientName},\n\nPayment of *UGX ${data.amount}* received on ${data.date}.\nLoan: ${data.accountNo} | Balance: UGX ${data.newBalance}\n\nThank you!`,

    DOWN_PAYMENT_RECEIVED:
      `💳 *${inst}* | Down Payment Received\n\nHi ${data.officerName},\n\n*${data.clientName}* has paid a down payment of *UGX ${data.amount}* for ${data.product}.\nDate: ${data.date}\n\nProceed with loan disbursement workflow.`,

    STANDING_INSTRUCTION_FAILED:
      `⚠️ *${inst}* | Standing Instruction Skipped\n\nHi ${data.officerName},\n\nStanding instruction for *${data.clientName}* (Savings: ${data.savingsAccountNo}) could NOT execute.\nReason: Insufficient confirmed deposit.\nRequired: UGX ${data.required} | Available: UGX ${data.available}\n\nManual action needed.`,

    LOAN_RESTRUCTURED:
      `🔄 *${inst}* | Loan Restructured\n\nHi ${data.officerName},\n\n*${data.clientName}'s* loan ${data.accountNo} has been restructured.\nNew schedule starts: ${data.newStartDate}\nBy: ${data.restructuredBy}`,

    LOAN_CHARGE_OFF:
      `📛 *${inst}* | Loan Charged Off\n\nHi ${data.officerName},\n\n*${data.clientName}'s* loan ${data.accountNo} has been charged off / classified as NPL.\nDate: ${data.date}\nBy: ${data.chargedOffBy}`,
  };

  return templates[event] ?? `*${inst}* notification: ${JSON.stringify(data)}`;
}

/** Notify a loan officer about a new note on their client's loan */
export async function notifyOfficerOfNote(params: {
  officerName: string;
  officerPhone: string;
  clientName: string;
  accountNo: string;
  note: string;
  addedBy: string;
  channel?: NotificationChannel;
}): Promise<NotificationResult[]> {
  const message = buildMessage("LOAN_NOTE_ADDED", {
    officerName: params.officerName,
    clientName: params.clientName,
    accountNo: params.accountNo,
    note: params.note,
    addedBy: params.addedBy,
    date: new Date().toLocaleDateString("en-UG"),
  });
  return sendNotification({
    event: "LOAN_NOTE_ADDED",
    recipientPhone: params.officerPhone,
    recipientName: params.officerName,
    message,
    channel: params.channel ?? (process.env.DEFAULT_NOTIFICATION_CHANNEL as NotificationChannel) ?? "whatsapp",
  });
}
