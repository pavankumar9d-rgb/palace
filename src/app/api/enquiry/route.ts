import { NextResponse } from 'next/server';

interface EnquiryPayload {
  name?: string;
  email?: string;
  phone?: string;
  preferredDates?: string;
  message?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EnquiryPayload;

    // Client-side validation is already performed; validate server-side presence
    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: 'Missing required fields: name and email are mandatory.' },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email address format.' },
        { status: 400 }
      );
    }

    // [[TBD: Configure private concierge email destination / CRM webhook endpoint]]
    return NextResponse.json(
      {
        message: 'Enquiry received. Backend submission pipeline is not yet configured.',
        status: 'TODO: Connect to estate booking CRM or notification provider',
      },
      { status: 501 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
