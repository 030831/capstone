package com.hyunjun.member.repository;

import com.hyunjun.member.domain.Team;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepository extends JpaRepository<Team, Long> {
}
