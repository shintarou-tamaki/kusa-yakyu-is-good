import React from "react";

export const Headline1 = ({ children, className = "", ...props }) => {
  return (
    <h1
      className={`text-3xl font-extrabold text-gray-900 mb-4 ${className}`}
      {...props}
    >
      {children}
    </h1>
  );
};

export default Headline1;
