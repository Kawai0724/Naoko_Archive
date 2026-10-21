import type { PublicMember } from '@/lib/identity-store';
export default function MemberList({members}:{members:PublicMember[]}){
  return <ol className="community-members">{members.map(m=><li key={m.username}><strong>{m.username}</strong><span className={`member-role ${m.role==='admin'?'member-role-admin':''}`}>{m.role==='admin'?'管理员':'贡献者'}</span><time dateTime={new Date(m.created_at).toISOString()}>{new Date(m.created_at).toISOString().slice(0,10)} 加入</time></li>)}</ol>;
}
