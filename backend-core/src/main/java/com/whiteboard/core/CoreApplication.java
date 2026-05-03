package com.whiteboard.core;

import com.whiteboard.core.user.User;
import com.whiteboard.core.user.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
public class CoreApplication {

	public static void main(String[] args) {
		SpringApplication.run(CoreApplication.class, args);
	}

	@Bean
	public CommandLineRunner dataLoader(UserRepository repo, PasswordEncoder encoder) {
		return args -> {
			if (!repo.existsByEmail("test")) {
				User user = new User();
				user.setEmail("test");
				user.setPassword(encoder.encode("test"));
				user.setName("테스트 유저");
				repo.save(user);
				System.out.println("✅ Test account 'test' with password 'test' created automatically!");
			}
		};
	}
}
