import React from 'react';

type ClaudeLogoProps = { className?: string };

const ClaudeLogo: React.FC<ClaudeLogoProps> = ({ className }) => {
  const classes = `w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white font-bold ${className}`;
  return <div className={classes}>C</div>;
};

export default ClaudeLogo;
