import { ShieldCheck, Star, MapPin, Search, Wallet, Car, Inbox, Navigation } from "lucide-react";

// Illustrative phone-frame mockups for the landing page's driver/
// passenger journey sections — deliberately NOT real app screenshots.
// There's no booted simulator/emulator or device available in this
// environment to capture real ones from, and the user chose "stay
// illustrative" over sending screenshot files or setting up a device
// for me to drive. Each one is a simplified, styled stand-in for the
// real screen it represents (same brand colors/components as the rest
// of the site), built to read clearly as "here's roughly what that step
// looks like," not to pass as an actual capture.
export type MockupKind =
  | "otp"
  | "vehicle"
  | "requests"
  | "otpVerify"
  | "collectPayment"
  | "search"
  | "payFee"
  | "tracking"
  | "rating";

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt-phone-frame">
      <div className="mkt-phone-notch" />
      <div className="mkt-phone-screen">{children}</div>
    </div>
  );
}

export function JourneyMockup({ kind }: { kind: MockupKind }) {
  switch (kind) {
    case "otp":
      return (
        <PhoneFrame>
          <div className="mkt-mock-label">Verify your number</div>
          <div className="mkt-mock-sub">OTP sent to +91 9XXXX XXXXX</div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {["4", "2", "9", "1"].map((d, i) => (
              <div key={i} className="mkt-mock-digit">{d}</div>
            ))}
          </div>
          <div className="mkt-mock-btn" style={{ marginTop: 18 }}>Verify & continue</div>
        </PhoneFrame>
      );

    case "vehicle":
      return (
        <PhoneFrame>
          <div className="mkt-mock-label">Add your vehicle</div>
          <div className="mkt-mock-field">Maruti Swift Dzire</div>
          <div className="mkt-mock-field">TN09 AB 1234</div>
          <div className="mkt-mock-row" style={{ marginTop: 12 }}>
            <div className="mkt-mock-chip">
              <Car size={12} /> RC uploaded
            </div>
          </div>
          <div className="mkt-mock-pill" style={{ marginTop: 14, background: "#FAEEDA", color: "#854F0B" }}>
            Pending review
          </div>
        </PhoneFrame>
      );

    case "requests":
      return (
        <PhoneFrame>
          <div className="mkt-mock-label">Booking requests</div>
          {[{ name: "Arjun R.", seats: "2 seats" }, { name: "Priya K.", seats: "1 seat" }].map((r) => (
            <div key={r.name} className="mkt-mock-request">
              <div className="mkt-mock-avatar">{r.name[0]}</div>
              <div style={{ flex: 1 }}>
                <div className="mkt-mock-request-name">{r.name}</div>
                <div className="mkt-mock-sub" style={{ margin: 0 }}>{r.seats}</div>
              </div>
              <Inbox size={14} color="#185FA5" />
            </div>
          ))}
          <div className="mkt-mock-btn" style={{ marginTop: 12 }}>Accept</div>
        </PhoneFrame>
      );

    case "otpVerify":
      return (
        <PhoneFrame>
          <div className="mkt-mock-label">Verify pickup</div>
          <div className="mkt-mock-sub">Ask your passenger for their code</div>
          <div className="mkt-mock-field" style={{ marginTop: 12, letterSpacing: 3, textAlign: "center" }}>4 2 9 1</div>
          <div className="mkt-mock-row" style={{ marginTop: 14, justifyContent: "center", gap: 6 }}>
            <ShieldCheck size={14} color="#3B6D11" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#3B6D11" }}>Trip starts once verified</span>
          </div>
        </PhoneFrame>
      );

    case "collectPayment":
      return (
        <PhoneFrame>
          <div className="mkt-mock-label">Trip completed</div>
          <div className="mkt-mock-amount">₹340</div>
          <div className="mkt-mock-sub">Remaining fare — collect via cash or UPI</div>
          <div className="mkt-mock-btn" style={{ marginTop: 16, background: "#3B6D11" }}>Mark as collected</div>
        </PhoneFrame>
      );

    case "search":
      return (
        <PhoneFrame>
          <div className="mkt-mock-label">Where to?</div>
          <div className="mkt-mock-field">
            <MapPin size={11} style={{ marginRight: 6, verticalAlign: -1 }} /> Koramangala
          </div>
          <div className="mkt-mock-field">
            <Navigation size={11} style={{ marginRight: 6, verticalAlign: -1 }} /> Whitefield
          </div>
          <div className="mkt-mock-row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <div className="mkt-mock-chip" style={{ background: "#185FA5", color: "#fff" }}>
              <Search size={12} /> Search rides
            </div>
          </div>
        </PhoneFrame>
      );

    case "payFee":
      return (
        <PhoneFrame>
          <div className="mkt-mock-label">Driver accepted!</div>
          <div className="mkt-mock-amount">₹45</div>
          <div className="mkt-mock-sub">Platform fee — pay to lock your seat</div>
          <div className="mkt-mock-btn" style={{ marginTop: 16 }}>
            <Wallet size={13} /> Pay now
          </div>
        </PhoneFrame>
      );

    case "tracking":
      return (
        <PhoneFrame>
          <div className="mkt-mock-map" aria-hidden="true">
            <div className="mkt-mock-map-dot" style={{ top: "30%", left: "22%" }} />
            <div className="mkt-mock-map-dot" style={{ top: "62%", left: "68%", background: "#D97F0A" }} />
            <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
              <line x1="22%" y1="30%" x2="68%" y2="62%" stroke="#185FA5" strokeWidth="2" strokeDasharray="4 4" />
            </svg>
          </div>
          <div className="mkt-mock-row" style={{ marginTop: 10, gap: 6 }}>
            <ShieldCheck size={13} color="#3B6D11" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#3B6D11" }}>Live — 8 min away</span>
          </div>
        </PhoneFrame>
      );

    case "rating":
      return (
        <PhoneFrame>
          <div className="mkt-mock-label">Trip complete</div>
          <div className="mkt-mock-sub">Rate your driver</div>
          <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={20} color="#D97F0A" fill={i < 4 ? "#D97F0A" : "none"} />
            ))}
          </div>
          <div className="mkt-mock-btn" style={{ marginTop: 16 }}>Submit rating</div>
        </PhoneFrame>
      );

    default:
      return null;
  }
}
