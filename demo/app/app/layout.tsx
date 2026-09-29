/**
 * The dashboard subtree is light by default with a remembered dark toggle;
 * the choice is applied before paint so there is no flash. The public demo
 * at /demo sits outside this subtree and keeps its own dark default.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            'try{var t=localStorage.getItem("dash_theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}',
        }}
      />
      {children}
    </>
  );
}
