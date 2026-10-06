import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import {
  findPatientsByPhone,
  parsePhone,
  verifyPhoneOtp,
} from "@/src/lib/auth/phoneOtp";
import { placeholderEmailForPhone } from "@/src/lib/auth/placeholderEmail";
import { establishPatientSessionCookie } from "@/src/lib/auth/oauth/establish-session";

export const dynamic = "force-dynamic";

const MAX_NAME = 255;

async function handle(req: Request) {
  let body: {
    phoneCountryCode?: unknown;
    phone?: unknown;
    otp?: unknown;
    mode?: unknown;
    name?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  const isRegister = body.mode === "register";
  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";

  // Check the name before the code is consumed so a missing name doesn't burn the OTP.
  if (isRegister && !name) {
    return NextResponse.json(
      { error: "NAME_REQUIRED", message: "Please enter your name." },
      { status: 400 }
    );
  }

  const parsed = parsePhone(body.phoneCountryCode, body.phone);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "INVALID_PHONE", message: parsed.message },
      { status: 400 }
    );
  }

  const verified = await verifyPhoneOtp(body.phoneCountryCode, body.phone, body.otp);
  if (!verified.ok) {
    return NextResponse.json(
      { error: verified.code, message: verified.message },
      { status: 400 }
    );
  }

  const { countryCode, nationalDigits } = verified;
  const matches = await findPatientsByPhone(countryCode, nationalDigits);

  let user: {
    id: string;
    email: string;
    name: string;
    role: string;
    onboardingComplete: boolean | null;
  };

  if (isRegister) {
    if (matches.length > 0) {
      return NextResponse.json(
        {
          error: "PHONE_TAKEN",
          message: "An account with this number already exists. Try signing in.",
        },
        { status: 409 }
      );
    }
    try {
      const [inserted] = await db
        .insert(users)
        .values({
          name,
          email: placeholderEmailForPhone(countryCode, nationalDigits),
          phoneCountryCode: countryCode,
          phone: nationalDigits,
          passwordHash: null,
          role: "patient",
          onboardingComplete: false,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          onboardingComplete: users.onboardingComplete,
        });
      if (!inserted) throw new Error("no row returned");
      user = inserted;
    } catch (e) {
      console.error("phone register", e);
      return NextResponse.json(
        {
          error: "PHONE_TAKEN",
          message: "An account with this number already exists. Try signing in.",
        },
        { status: 409 }
      );
    }
  } else {
    if (matches.length !== 1) {
      return NextResponse.json(
        {
          error: matches.length === 0 ? "USER_NOT_FOUND" : "AMBIGUOUS_PHONE",
          message:
            matches.length === 0
              ? "No account found with this number. Sign up to create one."
              : "More than one account uses this number. Sign in with your email, or contact support.",
        },
        { status: matches.length === 0 ? 404 : 409 }
      );
    }
    user = matches[0]!;
  }

  const session = await establishPatientSessionCookie(user, {
    method: isRegister ? "register" : "otp",
    userAgent: req.headers.get("user-agent"),
  });
  if ("error" in session) {
    return NextResponse.json(
      { error: "SERVER_MISCONFIGURED", message: session.error },
      { status: 500 }
    );
  }

  const nativeClient = req.headers.get("x-skinfit-client") === "native";
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      phoneCountryCode: countryCode,
      phone: nationalDigits,
      onboardingComplete: user.onboardingComplete ?? true,
    },
    ...(nativeClient ? { token: session.token } : {}),
  });
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    console.error("phone verify-otp", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
