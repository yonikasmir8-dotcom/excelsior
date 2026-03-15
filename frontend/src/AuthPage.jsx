import { SignIn, SignUp } from '@clerk/react'
import { useState } from 'react'

export default function AuthPage() {
  const [mode, setMode] = useState('sign-in')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ink)',
      backgroundImage: 'var(--halftone)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      gap: '2.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative comic panels background */}
      <div style={{ position:'absolute', inset:0, opacity:0.04, pointerEvents:'none', overflow:'hidden' }}>
        {['POW!','ZAP!','BAM!','KA-BOOM!','WHAM!'].map((w,i) => (
          <div key={i} style={{
            position:'absolute',
            fontFamily:"'Bangers', cursive",
            fontSize: `${6 + i*2}rem`,
            color:'var(--red)',
            left: `${[5,55,20,70,40][i]}%`,
            top:  `${[10,5,50,40,75][i]}%`,
            transform:`rotate(${[-12,8,-5,15,-8][i]}deg)`,
            letterSpacing:'0.05em',
            whiteSpace:'nowrap',
          }}>{w}</div>
        ))}
      </div>

      {/* Logo */}
      <div className="anim-up" style={{ textAlign:'center', zIndex:1 }}>
        <div style={{
          fontFamily:"'Bangers', cursive",
          fontSize: 'clamp(3rem, 8vw, 5rem)',
          letterSpacing:'0.04em',
          color: 'var(--yellow)',
          textShadow: '4px 4px 0 var(--red), 6px 6px 0 rgba(0,0,0,0.4)',
          lineHeight: 1,
          animation: 'bang 3s ease-in-out infinite',
        }}>
          EXCELSIOR!
        </div>
        <div style={{
          fontFamily:"'Barlow Condensed', sans-serif",
          fontSize: '0.8rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginTop: '0.5rem',
        }}>
          Your comic book universe, catalogued
        </div>
      </div>

      {/* Clerk Auth form */}
      <div className="anim-up" style={{ zIndex:1, animationDelay:'0.1s', width:'100%', maxWidth:'420px' }}>
        {mode === 'sign-in' ? (
          <SignIn
            appearance={{
              elements: {
                rootBox: { width: '100%' },
                card: { width: '100%' },
              },
              layout: {
                socialButtonsVariant: 'iconButton',
              },
              variables: {
                colorPrimary: '#d42b2b',
                colorBackground: '#181818',
                colorText: '#f0f0f0',
                colorTextSecondary: '#777',
                colorInputBackground: '#242424',
                colorInputText: '#f0f0f0',
                borderRadius: '3px',
                fontFamily: "'Barlow', sans-serif",
              }
            }}
            routing="hash"
          />
        ) : (
          <SignUp
            appearance={{
              elements: {
                rootBox: { width: '100%' },
                card: { width: '100%' },
              },
              layout: {
                socialButtonsVariant: 'iconButton',
              },
              variables: {
                colorPrimary: '#d42b2b',
                colorBackground: '#181818',
                colorText: '#f0f0f0',
                colorTextSecondary: '#777',
                colorInputBackground: '#242424',
                colorInputText: '#f0f0f0',
                borderRadius: '3px',
                fontFamily: "'Barlow', sans-serif",
              }
            }}
            routing="hash"
          />
        )}
      </div>

      {/* Toggle */}
      <div className="anim-up" style={{ zIndex:1, animationDelay:'0.2s', textAlign:'center' }}>
        {mode === 'sign-in' ? (
          <p style={{ fontFamily:"'Barlow Condensed', sans-serif", fontSize:'0.8rem', color:'var(--muted)', letterSpacing:'0.08em' }}>
            No secret identity yet?{' '}
            <button onClick={() => setMode('sign-up')} style={{
              background:'none', border:'none', color:'var(--yellow)',
              fontFamily:"inherit", fontSize:'inherit', letterSpacing:'inherit',
              cursor:'pointer', textDecoration:'underline',
            }}>Create yours now</button>
          </p>
        ) : (
          <p style={{ fontFamily:"'Barlow Condensed', sans-serif", fontSize:'0.8rem', color:'var(--muted)', letterSpacing:'0.08em' }}>
            Already have a secret identity?{' '}
            <button onClick={() => setMode('sign-in')} style={{
              background:'none', border:'none', color:'var(--yellow)',
              fontFamily:"inherit", fontSize:'inherit', letterSpacing:'inherit',
              cursor:'pointer', textDecoration:'underline',
            }}>Log in here</button>
          </p>
        )}
      </div>
    </div>
  )
}
