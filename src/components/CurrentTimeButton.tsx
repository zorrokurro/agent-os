import { useState, useEffect } from 'react';

interface CurrentTimeButtonProps {
  label?: string;
  onClick?: (time: string) => void;
}

const CurrentTimeButton: React.FC<CurrentTimeButtonProps> = ({
  label = 'Show Current Time',
  onClick,
}) => {
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString()
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    if (onClick) onClick(currentTime);
    else console.log('Current Time:', currentTime);
  };

  return (
    <button
      onClick={handleClick}
      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-mono transition-colors cursor-pointer"
      style={{
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {label}: {currentTime}
    </button>
  );
};

export default CurrentTimeButton;
