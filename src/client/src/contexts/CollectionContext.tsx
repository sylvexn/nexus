import { createContext, useContext, useState, ReactNode } from 'react'

interface CollectionContextType {
  selectedCollectionId: string | null
  setSelectedCollectionId: (id: string | null) => void
}

const CollectionContext = createContext<CollectionContextType | undefined>(undefined)

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)

  return (
    <CollectionContext.Provider value={{ selectedCollectionId, setSelectedCollectionId }}>
      {children}
    </CollectionContext.Provider>
  )
}

export function useCollection() {
  const context = useContext(CollectionContext)
  if (context === undefined) {
    throw new Error('useCollection must be used within a CollectionProvider')
  }
  return context
} 