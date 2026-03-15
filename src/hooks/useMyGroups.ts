'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export type GroupOption = { id: string; name: string }

export function useMyGroups() {
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      const { data: rows } = await supabase
        .from('family_members')
        .select('group_id')
        .eq('user_id', user.id)
      const ids = [...new Set((rows || []).map((r) => r.group_id).filter(Boolean))]
      if (ids.length === 0) {
        setLoading(false)
        return
      }
      const { data: grps } = await supabase
        .from('family_groups')
        .select('id, name')
        .in('id', ids)
      setGroups((grps || []).map((g) => ({ id: g.id, name: g.name || '그룹' })))
      setLoading(false)
    }
    load()
  }, [])

  return { groups, loading }
}
