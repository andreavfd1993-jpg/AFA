(() => {
  const cfg = window.AFA_CONFIG || {};
  const $ = id => document.getElementById(id);
  const requiredConfig = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("TU-PROYECTO") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("TU_CLAVE");
  let db = null, members = [], selectedMember = null, toastTimer = null;

  const loginView = $("loginView"), appView = $("appView");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const showToast = message => { const t=$("toast"); t.textContent=message; t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),3000); };
  const dateLabel = value => value ? new Date(value).toLocaleDateString("es-ES") : "—";

  function init() {
    if (!requiredConfig) {
      $("loginError").textContent = "Antes de entrar, configura SUPABASE_URL y SUPABASE_ANON_KEY en config.js.";
      $("loginForm").addEventListener("submit", e => { e.preventDefault(); $("loginError").textContent="Configura primero el proyecto Supabase en config.js."; });
      return;
    }
    db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    $("loginForm").addEventListener("submit", login);
    $("logoutBtn").addEventListener("click", logout);
    $("addBtn").addEventListener("click", () => openMemberForm());
    $("closeModal").addEventListener("click", closeMemberForm);
    $("cancelBtn").addEventListener("click", closeMemberForm);
    $("closeDetail").addEventListener("click", closeDetail);
    $("memberForm").addEventListener("submit", saveMember);
    $("searchInput").addEventListener("input", renderMembers);
    $("statusFilter").addEventListener("change", renderMembers);
    $("downloadCardBtn").addEventListener("click", () => selectedMember && createCardPdf(selectedMember, true));
    $("sendCardBtn").addEventListener("click", sendCard);
    db.auth.getSession().then(({data}) => data.session ? enterApp() : showLogin());
    db.auth.onAuthStateChange((_event, session) => session ? enterApp() : showLogin());
  }

  function showLogin(){loginView.classList.remove("hidden");appView.classList.add("hidden");}
  async function login(e){
    e.preventDefault(); $("loginError").textContent="";
    const {error}=await db.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
    if(error) $("loginError").textContent="No se ha podido iniciar sesión. Comprueba el correo y la contraseña.";
  }
  async function logout(){await db.auth.signOut();showLogin();}
  async function enterApp(){
    loginView.classList.add("hidden");appView.classList.remove("hidden");
    await loadMembers();
  }

  async function loadMembers(){
    $("membersBody").innerHTML='<tr><td colspan="6" class="empty">Cargando socios…</td></tr>';
    const {data,error}=await db.from("members").select("*").order("created_at",{ascending:false});
    if(error){$("membersBody").innerHTML='<tr><td colspan="6" class="empty">No se han podido cargar los socios. Comprueba la configuración y los permisos de Supabase.</td></tr>';return;}
    members=data||[]; renderMembers();
  }
  function renderMembers(){
    const q=$("searchInput").value.trim().toLocaleLowerCase("es");
    const status=$("statusFilter").value;
    const filtered=members.filter(m=>{
      const hay=[m.member_number,m.full_name,m.email,m.phone].join(" ").toLocaleLowerCase("es");
      return (!q||hay.includes(q))&&(status==="all"||m.status===status);
    });
    $("totalCount").textContent=members.length;
    $("activeCount").textContent=members.filter(m=>m.status==="active").length;
    $("inactiveCount").textContent=members.filter(m=>m.status==="inactive").length;
    if(!filtered.length){$("membersBody").innerHTML='<tr><td colspan="6" class="empty">No hay socios que coincidan con la búsqueda.</td></tr>';return;}
    $("membersBody").innerHTML=filtered.map(m=>`
      <tr>
        <td><span class="number">${escapeHtml(m.member_number)}</span></td>
        <td><div class="member-name">${escapeHtml(m.full_name)}</div><div class="member-sub">${escapeHtml(m.course||"Sin curso indicado")}</div></td>
        <td><div>${escapeHtml(m.email)}</div><div class="member-sub">${escapeHtml(m.phone||"Sin teléfono")}</div></td>
        <td>${escapeHtml(m.course||"—")}</td>
        <td><span class="status ${m.status==="active"?"active":"inactive"}">${m.status==="active"?"Activo":"Baja"}</span></td>
        <td><div class="actions"><button class="mini-btn" data-view="${m.id}" title="Ver ficha">Ver</button><button class="mini-btn" data-edit="${m.id}" title="Editar socio">Editar</button></div></td>
      </tr>`).join("");
    $("membersBody").querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>openDetail(b.dataset.view)));
    $("membersBody").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openMemberForm(members.find(m=>m.id===b.dataset.edit))));
  }

  function openMemberForm(m=null){
    $("memberForm").reset(); $("formError").textContent=""; $("memberId").value=m?.id||"";
    $("modalTitle").textContent=m?"Editar socio":"Añadir socio";
    $("saveBtn").textContent=m?"Guardar cambios":"Guardar socio";
    $("fullName").value=m?.full_name||"";$("email").value=m?.email||"";$("phone").value=m?.phone||"";
    $("course").value=m?.course||"";$("dni").value=m?.dni||"";$("address").value=m?.address||"";
    $("memberStatus").value=m?.status||"active";
    $("memberModal").classList.remove("hidden");
  }
  function closeMemberForm(){$("memberModal").classList.add("hidden");}
  async function saveMember(e){
    e.preventDefault(); $("formError").textContent="";
    const id=$("memberId").value;
    const payload={full_name:$("fullName").value.trim(),email:$("email").value.trim(),phone:$("phone").value.trim()||null,course:$("course").value.trim()||null,dni:$("dni").value.trim()||null,address:$("address").value.trim()||null,status:$("memberStatus").value};
    if(!payload.full_name||!payload.email){$("formError").textContent="Nombre y email son obligatorios.";return;}
    $("saveBtn").disabled=true;$("saveBtn").textContent="Guardando…";
    let result;
    if(id) result=await db.from("members").update(payload).eq("id",id);
    else result=await db.from("members").insert(payload);
    $("saveBtn").disabled=false;$("saveBtn").textContent=id?"Guardar cambios":"Guardar socio";
    if(result.error){$("formError").textContent=result.error.code==="23505"?"Ya existe un socio con ese email.":"No se ha podido guardar. Revisa los datos e inténtalo de nuevo.";return;}
    closeMemberForm();await loadMembers();showToast(id?"Socio actualizado":"Socio añadido correctamente");
  }

  function openDetail(id){
    selectedMember=members.find(m=>m.id===id);if(!selectedMember)return;
    const m=selectedMember;
    $("memberDetail").innerHTML=`
      <div class="card-preview"><div class="card-top">${escapeHtml(cfg.AFA_NAME||"AFA")} · CARNET DE SOCIO</div><div class="card-name">${escapeHtml(m.full_name)}</div><div class="card-number">N.º ${escapeHtml(m.member_number)}</div><div class="card-course">${escapeHtml(cfg.SCHOOL_YEAR||"")} · ${escapeHtml(m.course||"Socio/a")}</div></div>
      <div class="member-detail-grid">
        ${detail("Email",m.email)}${detail("Teléfono",m.phone)}${detail("Curso",m.course)}${detail("Estado",m.status==="active"?"Activo":"Baja")}${detail("DNI",m.dni)}${detail("Dirección",m.address)}${detail("Alta",dateLabel(m.created_at))}
      </div>`;
    $("detailTitle").textContent=m.full_name;
    $("sendMessage").textContent="El envío se realiza únicamente cuando pulses el botón.";
    $("detailModal").classList.remove("hidden");
  }
  function detail(label,value){return `<div class="detail-item"><small>${label}</small><strong>${escapeHtml(value||"—")}</strong></div>`;}
  function closeDetail(){$("detailModal").classList.add("hidden");selectedMember=null;}

  async function makePdf(m){
    const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:[86,54]});
    pdf.setFillColor(23,43,77);pdf.roundedRect(2,2,82,50,3,3,"F");
    pdf.setFillColor(49,91,154);pdf.circle(83,3,27,"F");
    pdf.setTextColor(205,220,240);pdf.setFont("helvetica","bold");pdf.setFontSize(7);
    pdf.text((cfg.AFA_NAME||"AFA DEL COLEGIO").toUpperCase().slice(0,38),8,12);
    pdf.setTextColor(255,255,255);pdf.setFontSize(12);pdf.text(m.full_name.slice(0,34),8,27);
    pdf.setFontSize(8);pdf.text("N.º SOCIO  "+m.member_number,8,34);
    pdf.setTextColor(210,224,242);pdf.setFont("helvetica","normal");pdf.setFontSize(6);
    pdf.text(`${cfg.SCHOOL_YEAR||""}  ·  ${(m.course||"Socio/a").slice(0,25)}`,8,41);
    pdf.text((cfg.SCHOOL_NAME||"").slice(0,38),8,47);
    const qrHost=document.createElement("div");qrHost.style.cssText="position:fixed;left:-9999px;top:0";document.body.appendChild(qrHost);
    new QRCode(qrHost,{text:`AFA|${m.id}|${m.member_number}`,width:128,height:128,correctLevel:QRCode.CorrectLevel.M});
    await new Promise(r=>setTimeout(r,150));
    const qrCanvas=qrHost.querySelector("canvas");
    if(qrCanvas) pdf.addImage(qrCanvas.toDataURL("image/png"),"PNG",66,25,12,12);
    qrHost.remove();
    return pdf;
  }
  async function createCardPdf(m,download){
    try{const pdf=await makePdf(m);if(download)pdf.save(`carnet-${m.member_number}.pdf`);return pdf;}
    catch(e){showToast("No se ha podido generar el PDF.");throw e;}
  }
  async function sendCard(){
    const m=selectedMember;if(!m)return;
    if(m.status!=="active"){showToast("No se puede enviar el carnet de un socio dado de baja.");return;}
    if(!confirm(`¿Enviar el carnet de ${m.full_name} a ${m.email}?`))return;
    $("sendCardBtn").disabled=true;$("sendCardBtn").textContent="Enviando…";$("sendMessage").textContent="Preparando el carnet y enviando el email…";
    try{
      const pdf=await createCardPdf(m,false);
      const base64=pdf.output("datauristring").split(",")[1];
      const {data:{session}}=await db.auth.getSession();
      const response=await fetch(`${cfg.SUPABASE_URL}/functions/v1/send-card`,{
        method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`,"apikey":cfg.SUPABASE_ANON_KEY},
        body:JSON.stringify({memberId:m.id,pdfBase64:base64})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Error de envío");
      $("sendMessage").textContent=`Carnet enviado a ${m.email}.`;
      showToast("Email enviado correctamente.");
    }catch(err){$("sendMessage").textContent="No se ha podido enviar el email. Comprueba la configuración del servicio de correo.";showToast("Error al enviar el carnet.");}
    finally{$("sendCardBtn").disabled=false;$("sendCardBtn").textContent="✉ Enviar carnet por email";}
  }

  init();
})();
