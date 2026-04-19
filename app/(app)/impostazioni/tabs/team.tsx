'use client'

import { useActionState, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { UserPlus, Trash2, ShieldCheck, Eye, Briefcase, Crown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
  type WorkspaceMember,
  type MemberRole,
} from '@/lib/actions/team'

const ROLE_LABELS: Record<MemberRole, { label: string; icon: React.ReactNode; desc: string }> = {
  admin:    { label: 'Admin',     icon: <ShieldCheck className="size-3.5" />, desc: 'Può modificare tutto tranne eliminare il workspace' },
  operator: { label: 'Operatore', icon: <Briefcase   className="size-3.5" />, desc: 'Può creare e modificare preventivi e clienti' },
  viewer:   { label: 'Viewer',    icon: <Eye          className="size-3.5" />, desc: 'Sola lettura' },
}

interface TeamTabProps {
  ownerEmail: string
  ownerName: string
  members: WorkspaceMember[]
  canInvite: boolean      // false se piano free/pro
  maxMembers: number      // 0 = nessuno, 5 = team
}

export function ImpostazioniTeam({ ownerEmail, ownerName, members, canInvite, maxMembers }: TeamTabProps) {
  const [role, setRole] = useState<'operator' | 'viewer'>('operator')
  const [formState, formAction, formPending] = useActionState(
    async (_prev: { error?: string; success?: boolean; name?: string } | null, fd: FormData) => {
      fd.set('role', role)
      const res = await inviteMemberAction(_prev, fd)
      if (res.success) toast.success(`${res.name ?? 'Utente'} aggiunto al workspace!`)
      else if (res.error) toast.error(res.error)
      return res
    },
    null
  )

  const ownerInitials = ownerName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div className="space-y-6">

      {/* Piano gate */}
      {!canInvite && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Funzione disponibile dal piano Team</p>
          <p className="text-xs mt-0.5 opacity-80">
            Passa al piano Team per aggiungere fino a 5 collaboratori con ruoli e permessi.{' '}
            <a href="/abbonamento" className="underline underline-offset-2 font-medium">
              Vedi piani →
            </a>
          </p>
        </div>
      )}

      {/* Form invito */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="size-4" />
            Invita collaboratore
          </CardTitle>
          <CardDescription>
            L&apos;utente deve avere già un account Carta Canta.
            {maxMembers > 0 && (
              <span className="ml-1 font-medium text-foreground">
                ({members.length}/{maxMembers} usati)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="team-email">Email</Label>
              <Input
                id="team-email"
                name="email"
                type="email"
                placeholder="collaboratore@esempio.it"
                required
                disabled={!canInvite || formPending}
              />
            </div>
            <div className="w-full sm:w-40 space-y-1.5">
              <Label>Ruolo</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as 'operator' | 'viewer')}
                disabled={!canInvite || formPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operatore</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:pt-7">
              <Button
                type="submit"
                disabled={!canInvite || formPending || members.length >= maxMembers}
              >
                {formPending && <Loader2 className="size-4 animate-spin" />}
                Invita
              </Button>
            </div>
          </form>

          {/* Descrizione ruoli */}
          <div className="mt-4 grid sm:grid-cols-3 gap-2">
            {(Object.entries(ROLE_LABELS) as [MemberRole, typeof ROLE_LABELS[MemberRole]][]).map(([key, r]) => (
              <div key={key} className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium mb-0.5">
                  {r.icon}
                  {r.label}
                </div>
                <p className="text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista membri */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Membri workspace</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Owner (sempre primo) */}
          <MemberRow
            email={ownerEmail}
            fullName={ownerName}
            role="admin"
            isOwner
          />

          {members.length > 0 && <Separator />}

          {members.map((m, i) => (
            <div key={m.user_id}>
              {i > 0 && <Separator />}
              <MemberRow
                userId={m.user_id}
                email={m.email}
                fullName={m.full_name}
                role={m.role}
                canEdit={canInvite}
              />
            </div>
          ))}

          {members.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Nessun collaboratore aggiunto ancora.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── MemberRow ──────────────────────────────────────────────────────────────────

function MemberRow({
  userId,
  email,
  fullName,
  role,
  isOwner = false,
  canEdit = false,
}: {
  userId?: string
  email: string
  fullName: string | null
  role: MemberRole
  isOwner?: boolean
  canEdit?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [currentRole, setCurrentRole] = useState<MemberRole>(role)

  const displayName = fullName ?? email
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const roleInfo = ROLE_LABELS[currentRole] ?? ROLE_LABELS['operator']!

  function handleRoleChange(newRole: MemberRole) {
    if (!userId) return
    setCurrentRole(newRole)
    startTransition(async () => {
      const res = await updateMemberRoleAction(userId, newRole)
      if (res.error) {
        toast.error(res.error)
        setCurrentRole(role) // rollback
      } else {
        toast.success('Ruolo aggiornato')
      }
    })
  }

  function handleRemove() {
    if (!userId || !confirm(`Rimuovere ${displayName} dal workspace?`)) return
    startTransition(async () => {
      const res = await removeMemberAction(userId)
      if (res.error) toast.error(res.error)
      else toast.success(`${displayName} rimosso`)
    })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {isOwner && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Crown className="size-2.5" /> Proprietario
            </Badge>
          )}
        </div>
        {fullName && <p className="text-xs text-muted-foreground truncate">{email}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isOwner ? (
          <Badge variant="outline" className="text-xs gap-1">
            {ROLE_LABELS['admin']!.icon}
            Admin
          </Badge>
        ) : canEdit && userId ? (
          <Select
            value={currentRole}
            onValueChange={(v) => handleRoleChange(v as MemberRole)}
            disabled={isPending}
          >
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="operator">Operatore</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className="text-xs gap-1">
            {roleInfo.icon}
            {roleInfo.label}
          </Badge>
        )}

        {!isOwner && userId && canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            disabled={isPending}
            onClick={handleRemove}
            title="Rimuovi membro"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </Button>
        )}
      </div>
    </div>
  )
}
