import { NextRequest, NextResponse } from "next/server"

async function handleWebhook(request: NextRequest) {
  const body = await request.text()
  console.log(body)
  return NextResponse.json({ message: "Webhook received" })
}

export const POST = handleWebhook
export const GET = handleWebhook    