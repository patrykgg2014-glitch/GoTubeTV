"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Video = {
  id: string; title: string; description: string | null;
  storage_path: string; created_at: string; user_id: string;
  profiles?: { username: string | null } | null;
};

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [ownerMode, setOwnerMode] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  async function refresh() {
    const { data } = await supabase.from("videos")
      .select("id,title,description,storage_path,created_at,user_id,profiles(username)")
      .eq("visibility", "public").order("created_at", { ascending: false });
    setVideos((data as any) ?? []);
  }

  useEffect(() => {
    refresh();
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("is_owner").eq("id", data.user.id).single();
        setIsOwner(Boolean(profile?.is_owner));
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setIsOwner(false);
      else supabase.from("profiles").select("is_owner").eq("id", session.user.id).single()
        .then(({ data }) => setIsOwner(Boolean(data?.is_owner)));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setNotice("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setNotice(error?.message ?? "Zalogowano.");
  }
  async function signUp() {
    setNotice("");
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } }
    });
    setNotice(error?.message ?? "Konto utworzone. Sprawdź pocztę, jeśli wymagane jest potwierdzenie adresu.");
  }
  async function signOut() {
    await supabase.auth.signOut(); setNotice("Wylogowano.");
  }
  async function uploadVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !file) { setNotice("Zaloguj się i wybierz plik wideo."); return; }
    if (!file.type.startsWith("video/")) { setNotice("Wybierz plik wideo."); return; }
    if (file.size > 500 * 1024 * 1024) { setNotice("Maksymalny rozmiar pliku w tym starterze to 500 MB."); return; }
    setNotice("Przesyłanie filmu…");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: storageError } = await supabase.storage.from("videos").upload(path, file, { contentType: file.type });
    if (storageError) { setNotice(storageError.message); return; }
    const { error } = await supabase.from("videos").insert({
      user_id: user.id, title, description, storage_path: path, visibility: "public"
    });
    if (error) { setNotice(error.message); return; }
    setTitle(""); setDescription(""); setFile(null); setNotice("Film opublikowany."); refresh();
  }

  return <main>
    <header className="topbar">
      <a className="brand" href="/">GoTube<span>TV</span><i>✓</i></a>
      <nav><a href="#filmy">Odkrywaj</a><a href="#dodaj">Prześlij film</a></nav>
      <div className="account">{user ? <><span>{user.user_metadata?.username || user.email}</span><button className="outline" onClick={signOut}>Wyloguj</button></> : <a className="button" href="#konto">Zaloguj się</a>}</div>
    </header>

    <section className="hero">
      <p className="eyebrow">TWOJA PRZESTRZEŃ WIDEO</p>
      <h1>Oglądaj. Publikuj.<br/><span>Twórz swoją społeczność.</span></h1>
      <p>Witaj na GoTubeTV — platformie, na której kanały i filmy tworzą użytkownicy.</p>
      <a className="button" href="#filmy">Odkrywaj filmy</a>
    </section>

    <section id="filmy" className="section">
      <div className="sectionhead"><div><p className="eyebrow">SPOŁECZNOŚĆ GOTUBETV</p><h2>Najnowsze filmy</h2></div></div>
      {videos.length === 0 ? <div className="empty"><div className="play">▶</div><h3>Na razie nie ma filmów</h3><p>Gdy ktoś opublikuje pierwszy film, pojawi się tutaj.</p></div> :
      <div className="videos">{videos.map(v => {
        const { data } = supabase.storage.from("videos").getPublicUrl(v.storage_path);
        return <article className="video" key={v.id}><video controls preload="metadata" src={data.publicUrl}/><h3>{v.title}</h3><p>{v.profiles?.username || "Użytkownik GoTubeTV"}</p>{v.description && <small>{v.description}</small>}</article>;
      })}</div>}
    </section>

    <section id="konto" className="section accountsection">
      <div><p className="eyebrow">DOŁĄCZ DO SPOŁECZNOŚCI</p><h2>{user ? "Twoje konto" : "Konto GoTubeTV"}</h2>
        <p>Załóż konto, loguj się i publikuj filmy na swoim kanale.</p>
      </div>
      {!user ? <form className="panel" onSubmit={signIn}>
        <label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label>Hasło<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} /></label>
        <button className="button" type="submit">Zaloguj się</button>
        <div className="or">Nie masz konta? Utwórz je poniżej.</div>
        <label>Nazwa profilu<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Twoja nazwa" /></label>
        <button className="outline full" type="button" onClick={signUp}>Utwórz konto</button>
        <button className="ownerlink" type="button" onClick={()=>setOwnerMode(!ownerMode)}>Logowanie do Właściciela</button>
        {ownerMode && <p className="hint">Właściciel loguje się przez to samo bezpieczne logowanie. Panel pojawi się wyłącznie na koncie, któremu administrator serwera nadał rolę właściciela.</p>}
      </form> : <div className="panel"><h3>Zalogowano</h3><p>{user.email}</p>{isOwner && <p className="verified">✓ Właściciel GoTubeTV</p>}</div>}
    </section>

    {user && <section id="dodaj" className="section uploadsection">
      <div><p className="eyebrow">TWÓJ KANAŁ</p><h2>Prześlij film</h2><p>Dodaj film, który będzie widoczny w publicznej sekcji po opublikowaniu.</p></div>
      <form className="panel" onSubmit={uploadVideo}>
        <label>Tytuł filmu<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} /></label>
        <label>Opis<textarea maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} /></label>
        <label>Plik wideo<input type="file" accept="video/*" required onChange={e=>setFile(e.target.files?.[0] ?? null)} /></label>
        <button className="button" type="submit">Opublikuj film</button>
      </form>
    </section>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {isOwner && <section className="ownerpanel"><h2>Panel właściciela <span className="verified">✓</span></h2><p>Jesteś zalogowany na konto z rolą właściciela. Dalsze narzędzia administracyjne należy dodać z kontrolą uprawnień po stronie serwera.</p></section>}
    <footer><a className="brand" href="/">GoTube<span>TV</span><i>✓</i></a><p>© {new Date().getFullYear()} GoTubeTV. Publikuj odpowiedzialnie i szanuj prawa autorskie.</p></footer>
  </main>;
}
