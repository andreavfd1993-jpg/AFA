import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return reply({ error: "No autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL");
    if (!resendKey || !fromEmail) return reply({ error: "El servicio de correo no está configurado" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return reply({ error: "Sesión no válida" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { data: admin } = await adminClient
      .from("afa_admins").select("user_id").eq("user_id", userData.user.id).maybeSingle();
    if (!admin) return reply({ error: "No tienes permisos para enviar carnets" }, 403);

    const body = await req.json();
    const memberId = String(body.memberId || "");
    const pdfBase64 = String(body.pdfBase64 || "");
    if (!memberId || !/^[A-Za-z0-9+/=]+$/.test(pdfBase64) || pdfBase64.length > 2_000_000) {
      return reply({ error: "Datos del carnet no válidos" }, 400);
    }

    const { data: member, error: memberError } = await adminClient
      .from("members")
      .select("id, member_number, full_name, email, status")
      .eq("id", memberId).maybeSingle();
    if (memberError || !member) return reply({ error: "Socio no encontrado" }, 404);
    if (member.status !== "active") return reply({ error: "El socio no está activo" }, 400);

    const safeName = member.full_name.replace(/[<>]/g, "");
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [member.email],
        subject: `Tu carnet del ${Deno.env.get("AFA_NAME") || "AFA"}`,
        html: `<div style="font-family:Arial,sans-serif;color:#24334b;max-width:560px;margin:auto"><h2>¡Bienvenido/a al AFA!</h2><p>Hola ${safeName},</p><p>Adjuntamos tu carnet digital de socio/a número <strong>${member.member_number}</strong>.</p><p>Gracias por formar parte de nuestra asociación.</p><p style="color:#718096;font-size:12px">Este mensaje se ha enviado desde la administración del AFA.</p></div>`,
        attachments: [{
          filename: `carnet-${member.member_number}.pdf`,
          content: pdfBase64,
        }],
      }),
    });
    const emailResult = await emailResponse.json();
    if (!emailResponse.ok) {
      return reply({ error: "El proveedor de correo ha rechazado el envío", detail: emailResult?.message || null }, 502);
    }
    return reply({ success: true, emailId: emailResult.id });
  } catch (_error) {
    return reply({ error: "Error interno al procesar el envío" }, 500);
  }
});
