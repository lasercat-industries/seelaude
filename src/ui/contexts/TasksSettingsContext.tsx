import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface TasksSettingsContextType {
  tasksEnabled: boolean;
  setTasksEnabled: (enabled: boolean) => void;
}

const TasksSettingsContext = createContext<TasksSettingsContextType | undefined>(undefined);

export const TasksSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasksEnabled, setTasksEnabled] = useState(true);

  return (
    <TasksSettingsContext.Provider value={{ tasksEnabled, setTasksEnabled }}>
      {children}
    </TasksSettingsContext.Provider>
  );
};

export const useTasksSettings = () => {
  const context = useContext(TasksSettingsContext);
  if (!context) {
    // Return default values if no provider
    return { tasksEnabled: false, setTasksEnabled: () => {} };
  }
  return context;
};