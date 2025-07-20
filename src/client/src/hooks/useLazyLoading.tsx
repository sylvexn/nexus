import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

interface LazyLoadingOptions<T> {
  queryKey: string[]
  queryFn: (params: { pageParam: number; pageSize: number }) => Promise<{ items: T[]; hasNextPage: boolean; totalCount?: number }>
  pageSize?: number
  threshold?: number
  enabled?: boolean
  staleTime?: number
}

export function useLazyLoading<T>({
  queryKey,
  queryFn,
  pageSize = 20,
  threshold = 300,
  enabled = true,
  staleTime = 30000
}: LazyLoadingOptions<T>) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const loadingRef = useRef<HTMLDivElement>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) => queryFn({ pageParam: pageParam as number, pageSize }),
    getNextPageParam: (lastPage: any, pages) => {
      return lastPage.hasNextPage ? pages.length : undefined
    },
    initialPageParam: 0,
    enabled,
    staleTime,
    refetchOnWindowFocus: false
  })

  // Intersection observer for infinite scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
      },
      { 
        threshold: 0.1,
        rootMargin: `${threshold}px`
      }
    )

    if (loadingRef.current) {
      observer.observe(loadingRef.current)
    }

    return () => observer.disconnect()
  }, [threshold])

  // Auto-fetch when intersecting
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage])

  const allItems = useMemo(() => {
    return data?.pages.flatMap((page: any) => page.items) ?? []
  }, [data])

  const totalCount = useMemo(() => {
    return data?.pages[0]?.totalCount ?? allItems.length
  }, [data, allItems.length])

  return {
    items: allItems,
    totalCount,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    refetch,
    loadingRef
  }
}

interface VirtualScrollOptions {
  itemHeight: number
  containerHeight: number
  overscan?: number
}

export function useVirtualScroll<T>(
  items: T[],
  { itemHeight, containerHeight, overscan = 5 }: VirtualScrollOptions
) {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const visibleItems = useMemo(() => {
    const viewportHeight = containerHeight
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
    )

    const visibleItems = []
    for (let i = startIndex; i < endIndex; i++) {
      visibleItems.push({
        index: i,
        item: items[i],
        offsetY: i * itemHeight
      })
    }

    return {
      items: visibleItems,
      totalHeight: items.length * itemHeight,
      startIndex,
      endIndex
    }
  }, [items, scrollTop, itemHeight, containerHeight, overscan])

  return {
    scrollElementRef,
    handleScroll,
    visibleItems,
    totalHeight: visibleItems.totalHeight
  }
}

export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
        setEntry(entry)
      },
      {
        threshold: 0.1,
        ...options
      }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [options])

  return {
    elementRef,
    isIntersecting,
    entry
  }
}

interface LazyImageOptions {
  src: string
  placeholder?: string
  threshold?: number
  fallback?: string
}

export function useLazyImage({
  src,
  placeholder,
  threshold = 0.1,
  fallback
}: LazyImageOptions) {
  const [imageSrc, setImageSrc] = useState(placeholder || '')
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const { elementRef, isIntersecting } = useIntersectionObserver({ threshold })

  useEffect(() => {
    if (isIntersecting && src && !isLoaded && !hasError) {
      const img = new Image()
      
      img.onload = () => {
        setImageSrc(src)
        setIsLoaded(true)
      }
      
      img.onerror = () => {
        setHasError(true)
        if (fallback) {
          setImageSrc(fallback)
        }
      }
      
      img.src = src
    }
  }, [isIntersecting, src, isLoaded, hasError, fallback])

  return {
    elementRef,
    imageSrc,
    isLoaded,
    hasError,
    isIntersecting
  }
} 