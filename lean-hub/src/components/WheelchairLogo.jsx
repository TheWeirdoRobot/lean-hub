export default function WheelchairLogo({ size = 32, color = '#6E56CF' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Speed lines */}
      <line x1="0.5" y1="13" x2="6.5" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
      <line x1="0.5" y1="17" x2="5.5" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="1"   y1="21" x2="5.5" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>

      {/* Wheelchair frame */}
      <line x1="11" y1="19" x2="25" y2="19" stroke={color} strokeWidth="2"   strokeLinecap="round"/>
      <line x1="25" y1="12" x2="25" y2="20" stroke={color} strokeWidth="2"   strokeLinecap="round"/>
      <line x1="11" y1="19" x2="11" y2="23" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9"  y1="23" x2="15" y2="23" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>

      {/* Person — torso leaning ~40° right */}
      <circle cx="23" cy="9" r="3" fill={color}/>
      <line x1="16" y1="19" x2="22" y2="12" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      {/* Arm flailing for balance */}
      <line x1="19" y1="15.5" x2="13" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>

      {/* Large rear wheel */}
      <circle cx="22" cy="26" r="8" stroke={color} strokeWidth="2" fill="none"/>
      <line x1="22"  y1="18"  x2="22"  y2="34"  stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <line x1="14"  y1="26"  x2="30"  y2="26"  stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <line x1="16.3" y1="20.3" x2="27.7" y2="31.7" stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <line x1="27.7" y1="20.3" x2="16.3" y2="31.7" stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <circle cx="22" cy="26" r="1.5" fill={color}/>

      {/* Small front caster */}
      <circle cx="11" cy="27" r="2.5" stroke={color} strokeWidth="1.5" fill="none"/>
    </svg>
  )
}
