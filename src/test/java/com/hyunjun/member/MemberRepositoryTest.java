package com.hyunjun.member;

import static com.hyunjun.member.domain.QMember.member;
import static org.assertj.core.api.Assertions.assertThat;

import com.hyunjun.member.domain.Member;
import com.hyunjun.member.domain.Team;
import com.hyunjun.member.repository.MemberRepository;
import com.hyunjun.member.repository.TeamRepository;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
class MemberRepositoryTest {

    @Autowired MemberRepository memberRepository;
    @Autowired TeamRepository teamRepository;
    @Autowired JPAQueryFactory queryFactory;

    @Test
    @Transactional
    void 회원_저장_조회_수정() {
        Team team = teamRepository.save(new Team("백엔드"));
        Member kim = memberRepository.save(new Member("kim", 20, team));

        kim.changeName("lee");

        List<Member> result = queryFactory
                .selectFrom(member)
                .where(member.team.name.eq("백엔드"))
                .fetch();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("lee");
    }
}
